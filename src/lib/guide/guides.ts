// src/lib/guide/guides.ts
//
// The user guides: one source for the in-app guide (/guide and the
// dashboard's Guide page) and the printable PDFs (scripts/brand/build-guides.mjs).
// Each guide is written for one kind of person; the dashboard only shows a
// signed-in person the guides for their own role.

export interface GuideSection {
  id: string;
  title: string;
  intro?: string;
  steps: string[];
  tip?: string;
}

export interface Guide {
  id: GuideId;
  title: string;
  tagline: string;
  sections: GuideSection[];
  faq: [string, string][];
}

export type GuideId = 'customer' | 'owner' | 'receptionist' | 'barber' | 'platform';

const INSTALL: GuideSection = {
  id: 'install',
  title: 'Put it on your home screen',
  intro: 'The Chair App installs like an app, with no app store.',
  steps: [
    'On Android or desktop Chrome, tap Install in the banner at the bottom of the page, or choose Install app from the browser menu.',
    'On iPhone, open the page in Safari, tap the Share button, then choose Add to Home Screen.',
    'Open it from your home screen. It runs full screen and remembers you.',
  ],
  tip: 'Every salon, and every barber, is its own app. Install the one you use most.',
};

const SIGN_IN: GuideSection = {
  id: 'sign-in',
  title: 'Sign in and keep your password safe',
  steps: [
    'Go to Sign in. Use the email and password you were given or chose.',
    'If you were given a temporary password, you will be asked to choose your own the first time. Pick something only you know.',
    'Forgot it? Choose Forgot password. If no email arrives, write to the support address in the footer and they will reset it.',
    'Always Sign out on a shared phone or computer.',
  ],
};

const DISPLAY: GuideSection = {
  id: 'display',
  title: 'Make it easier to read',
  steps: [
    'Scroll to the footer and tap Display.',
    'Choose Light, Dark or Auto for the theme. Pick A+ or A++ for larger text.',
    'Turn on High contrast or Reduce motion if you need them. Your choices are remembered on this device.',
  ],
};

export const GUIDES: Guide[] = [
  {
    id: 'customer',
    title: 'Customer Guide',
    tagline: 'Find a barber, book in a minute, and keep track of your appointments.',
    sections: [
      {
        id: 'find',
        title: 'Find a barber or salon',
        intro: 'The home page lists salons and barbers near you.',
        steps: [
          'Type a salon, barber or service in the search box, or tap a quick pick such as Fade or Braids.',
          'Tap Near me to sort by distance. Your phone will ask for permission to use your location.',
          'Use Sort and 4+ only to narrow the list. Switch between List and Map to see where each salon is.',
          'Tap the heart on a salon to save it. You need to be signed in.',
        ],
        tip: 'Barbers appear in their own row. Tap one to see their photos, reviews and posts.',
      },
      {
        id: 'book',
        title: 'Book an appointment',
        steps: [
          'Open a salon, or a barber, and tap Book.',
          'Choose a service, then a barber if you have not already.',
          'Pick a date. Only times the barber can really take are shown.',
          'Add your details (they are filled in if you are signed in) and confirm.',
          'You get a confirmation on screen and by email when the salon has email switched on.',
        ],
        tip: 'A new booking starts as Pending until the salon confirms it.',
      },
      {
        id: 'manage',
        title: 'Check or change a booking',
        steps: [
          'Open My appointments from the salon menu to see each booking and its status: Pending, Confirmed, Completed or Cancelled.',
          'Tap Cancel booking on an upcoming appointment if you cannot come. You will be asked to confirm, and the time goes back to other customers.',
          'Tap Add to calendar to put the visit in your phone’s calendar.',
          'To change the time, cancel and book a new one, or contact the salon. Their phone is on their page.',
        ],
      },
      {
        id: 'follow',
        title: 'Follow, review and earn points',
        steps: [
          'Tap Follow on a barber to see their new posts in the Stylist feed.',
          'After a completed visit you can leave a review with a star rating.',
          'You earn one loyalty point for every whole unit of currency spent on a completed visit.',
        ],
      },
      INSTALL,
      SIGN_IN,
      DISPLAY,
    ],
    faq: [
      ['Do I need an account to book?', 'No. You can book as a guest with your name, email and phone. An account saves your details and lets you follow barbers and review visits.'],
      ['Can I cancel online?', 'Yes, for upcoming Pending or Confirmed bookings, from My appointments. For anything else, contact the salon.'],
      ['Why is my booking Pending?', 'The salon confirms bookings. You will see the status change to Confirmed on My appointments.'],
      ['I do not see my barber.', 'A barber only appears if the salon has added them and given them working hours. Contact the salon.'],
      ['Is my location stored?', 'No. It is used only to sort results by distance, for that search.'],
    ],
  },
  {
    id: 'owner',
    title: 'Owner Guide',
    tagline: 'Set up your salon, build your team, and run the day.',
    sections: [
      {
        id: 'setup',
        title: 'Set up your salon',
        intro: 'Everything here is under Settings in the dashboard.',
        steps: [
          'Business info: add your name, description, phone and email.',
          'Branding: choose your colours and typeface, and upload a logo and cover image. Your public page and booking use them.',
          'Pricing: choose your currency.',
          'Location: drop a pin so customers can find you on the map and by distance.',
          'Tap Save settings.',
          'Share your salon: tap Link and QR code to copy your booking link or download a QR to print.',
        ],
        tip: 'Add a logo and a location first. Salons with both appear far better in discovery.',
      },
      {
        id: 'services',
        title: 'Add your services',
        steps: [
          'Open Services. Create categories such as Cuts or Beard.',
          'Add each service with a price and duration. Photos help.',
          'If only some barbers do a service, choose them in the service. Customers will only be offered those barbers.',
        ],
      },
      {
        id: 'barbers',
        title: 'Add your barbers',
        steps: [
          'Open Barbers and tap Add barber.',
          'Enter their name, bio, specialties and photos. Choose their working hours for each day.',
          'Use App link on a barber to get their own link and QR code. Customers who open it can book that barber and install their app.',
        ],
        tip: 'Print the QR code for the mirror or business card. It opens straight to booking with that barber.',
      },
      {
        id: 'staff',
        title: 'Invite your team',
        steps: [
          'Open Staff and add a receptionist or barber.',
          'The app creates a welcome PDF with their sign-in details, a guide for their role and QR codes. Print it or send it privately.',
          'They sign in with the temporary password and must choose their own straight away.',
          'Lost access? Use Reissue access to give a new temporary password. It signs them out everywhere.',
        ],
      },
      {
        id: 'day',
        title: 'Run the day',
        intro: 'A red number on the Appointments tab (and in the browser tab title) shows bookings waiting for you to confirm.',
        steps: [
          'Appointments shows bookings by date. Filter by status and change a status from the list.',
          'Confirm Pending bookings. Customers can cancel their own upcoming bookings online, and you will see them as Cancelled. Mark visits Completed when done; that is when loyalty points are earned.',
          'Add walk-ins on the Waitlist and seat them when a chair frees up.',
          'Customers keeps your client list. Search, add or edit a client, or tap Export CSV to open it in a spreadsheet.',
          'On Appointments, tap Export CSV or Print for the day’s list.',
        ],
      },
      {
        id: 'grow',
        title: 'Grow your reputation',
        steps: [
          'Posts: share photos of your work. They appear on your page and the Stylist feed.',
          'Reviews: read what customers say. You can hide a review that breaks the rules.',
          'Analytics: see bookings, busy days and what sells.',
        ],
      },
      INSTALL,
      SIGN_IN,
      DISPLAY,
    ],
    faq: [
      ['A customer cannot find a time.', 'Check the barber’s working hours under Barbers, and that the service is not restricted to other barbers.'],
      ['How do I change my currency?', 'Settings, then Pricing. Existing prices keep their numbers; check them after changing.'],
      ['Can I remove someone?', 'Yes. Open Staff or Barbers and remove them. This cannot be undone.'],
      ['Where do points come from?', 'One point per whole currency unit on each Completed visit, once per visit.'],
    ],
  },
  {
    id: 'receptionist',
    title: 'Receptionist Guide',
    tagline: 'Keep the diary moving: confirm, seat, and look after clients.',
    sections: [
      {
        id: 'diary',
        title: 'Handle the diary',
        steps: [
          'Open Appointments. Pick a date to see the day.',
          'Confirm Pending bookings so customers know they are in.',
          'Change a booking to Cancelled if the customer cannot come. Use Completed when the visit is done.',
        ],
      },
      {
        id: 'walkins',
        title: 'Walk-ins and the waitlist',
        steps: [
          'Open Waitlist and tap Add walk-in. Enter their name, contact, service and barber.',
          'When a chair is free, tap Seat now. Remove anyone who leaves.',
        ],
      },
      {
        id: 'clients',
        title: 'Look after clients',
        steps: [
          'Open Customers and search by name, email or phone.',
          'Tap Edit to correct details, or Add to create a client for a phone booking.',
        ],
        tip: 'Always take a phone number. It is how the barber reaches the client.',
      },
      SIGN_IN,
      INSTALL,
      DISPLAY,
    ],
    faq: [
      ['I cannot see Services or Settings.', 'Those are for the owner. Ask them to make the change.'],
      ['A client booked twice.', 'Cancel the duplicate from Appointments by setting its status to Cancelled.'],
    ],
  },
  {
    id: 'barber',
    title: 'Barber Guide',
    tagline: 'See your day, show your work, and build your following.',
    sections: [
      {
        id: 'today',
        title: 'See your day',
        steps: [
          'Open Overview for today’s appointments.',
          'Open Appointments for your full list. You can confirm, complete or cancel your own bookings.',
        ],
      },
      {
        id: 'posts',
        title: 'Post your work',
        steps: [
          'Open Posts. Choose the photo and write a caption.',
          'Publish. It shows on your profile and in the Stylist feed for people who follow you.',
        ],
        tip: 'Before and after photos get the most attention. Ask the client first.',
      },
      {
        id: 'app',
        title: 'Your own app',
        steps: [
          'Ask the owner for your App link, or open your profile page from the salon.',
          'Tap Install on your page so it sits on your home screen. Share the link or QR with clients.',
          'Clients who install your app can book you straight away.',
        ],
      },
      SIGN_IN,
      INSTALL,
      DISPLAY,
    ],
    faq: [
      ['Why can I not change my hours?', 'The owner sets working hours under Barbers. Ask them to update yours.'],
      ['Where are my reviews?', 'They show on your profile page with your star rating.'],
    ],
  },
  {
    id: 'platform',
    title: 'Platform Admin Guide',
    tagline: 'Look after every salon on The Chair App.',
    sections: [
      {
        id: 'tenants',
        title: 'Manage salons',
        steps: [
          'Open Tenants to see every salon. Search, open one to see its details.',
          'Create a salon: the owner receives a welcome PDF with their sign-in details.',
          'Suspend a salon to stop its staff and customers signing in or booking. Reactivate it to restore access.',
          'Delete is permanent and removes the salon and everything in it. Confirm carefully.',
        ],
      },
      {
        id: 'people',
        title: 'People and access',
        steps: [
          'Platform admins: add or remove other admins.',
          'Staff: find any staff member and reissue access with a new temporary password.',
          'Security: sign out every session for an email address if an account may be compromised.',
        ],
      },
      {
        id: 'trust',
        title: 'Keep it trustworthy',
        steps: [
          'Moderation: review customer reviews and remove ones that break the rules.',
          'Audit log: see who did what, and when.',
          'Analytics: watch signups, bookings and activity across the platform.',
        ],
      },
      INSTALL,
      DISPLAY,
    ],
    faq: [
      ['Can I sign in on the public page?', 'No. Platform admins sign in at /admin/login.'],
      ['Is a deleted salon recoverable?', 'No. Suspend instead if you may need it back.'],
    ],
  },
];

export function guideById(id: string): Guide | undefined {
  return GUIDES.find((g) => g.id === id);
}

const DASHBOARD_ORDER: GuideId[] = ['owner', 'receptionist', 'barber'];

/** Guides a signed-in staff member should see, most senior first. */
export function guidesForStaffRole(role: 'admin' | 'receptionist' | 'barber'): Guide[] {
  const ids: GuideId[] = role === 'admin' ? ['owner'] : [role];
  return DASHBOARD_ORDER.filter((id) => ids.includes(id)).map((id) => guideById(id)!);
}
