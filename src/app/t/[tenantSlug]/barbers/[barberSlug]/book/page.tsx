// src/app/t/[tenantSlug]/barbers/[barberSlug]/book/page.tsx
//
// "Book with me" inside the barber's own app scope. Same booking flow as the
// salon's /book page (which reads barberSlug from the route to preselect the
// barber); living under the barber path keeps an installed barber app from
// bouncing out to the browser mid-booking.
export { default } from '../../../book/page';
