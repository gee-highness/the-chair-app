// src/app/api/analytics/route.ts
//
// New in Part 2. Admin-only aggregate view over the tenant's own
// appointments: bookings/day, revenue/day (completed only), and
// busiest barbers/services over the selected window. All tenant-scoped
// from the session, same as every other staff route.
import { NextRequest, NextResponse } from 'next/server';
import { getDatabase } from '@/lib/mongodb';
import { requireRole } from '@/lib/requireRole';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await requireRole(req, ['admin']);
  if (!session?.tenantId) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  try {
    const days = Math.min(parseInt(req.nextUrl.searchParams.get('days') || '30', 10) || 30, 180);
    const since = new Date();
    since.setDate(since.getDate() - days);
    since.setHours(0, 0, 0, 0);

    const db = await getDatabase();

    const rows = await db
      .collection('appointments')
      .aggregate([
        { $match: { tenantId: session.tenantId, dateTime: { $gte: since } } },
        { $lookup: { from: 'services', localField: 'serviceId', foreignField: '_id', as: 'service' } },
        { $lookup: { from: 'barbers', localField: 'barberId', foreignField: '_id', as: 'barber' } },
        {
          $addFields: {
            servicePrice: { $arrayElemAt: ['$service.price', 0] },
            serviceName: { $arrayElemAt: ['$service.name', 0] },
            barberName: { $arrayElemAt: ['$barber.name', 0] },
            day: { $dateToString: { format: '%Y-%m-%d', date: '$dateTime' } },
          },
        },
        { $project: { day: 1, status: 1, servicePrice: 1, serviceName: 1, barberName: 1 } },
      ])
      .toArray();

    const byDay = new Map<string, { bookings: number; revenue: number }>();
    const byBarber = new Map<string, number>();
    const byService = new Map<string, number>();

    for (const r of rows) {
      const dayEntry = byDay.get(r.day) || { bookings: 0, revenue: 0 };
      dayEntry.bookings += 1;
      if (r.status === 'completed') dayEntry.revenue += r.servicePrice || 0;
      byDay.set(r.day, dayEntry);

      if (r.barberName) byBarber.set(r.barberName, (byBarber.get(r.barberName) || 0) + 1);
      if (r.serviceName) byService.set(r.serviceName, (byService.get(r.serviceName) || 0) + 1);
    }

    const timeline = Array.from(byDay.entries())
      .map(([day, v]) => ({ day, ...v }))
      .sort((a, b) => a.day.localeCompare(b.day));

    const topBarbers = Array.from(byBarber.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const topServices = Array.from(byService.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const totalRevenue = timeline.reduce((sum, d) => sum + d.revenue, 0);
    const totalBookings = timeline.reduce((sum, d) => sum + d.bookings, 0);

    return NextResponse.json({ timeline, topBarbers, topServices, totalRevenue, totalBookings, days });
  } catch (error: any) {
    return NextResponse.json({ message: 'Failed to compute analytics', error: error.message }, { status: 500 });
  }
}
