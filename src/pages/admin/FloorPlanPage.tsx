const FLOOR_PLANS = [
  {
    id: 'cltwsf01',
    src: '/floor-plans/cltwsf01.png',
    title: 'Meeting space — Floor plan 1',
    alt: 'Sheraton Charlotte meeting room floor plan 1',
  },
  {
    id: 'cltwsf02',
    src: '/floor-plans/cltwsf02.png',
    title: 'Meeting space — Floor plan 2',
    alt: 'Sheraton Charlotte meeting room floor plan 2',
  },
] as const;

export function FloorPlanPage() {
  return (
    <section className="floor-plan-page">
      <h1>Floor plan</h1>
      <p>
        Official Sheraton Charlotte meeting-space maps from the hotel events
        page. Use these when placing door tablets or directing guests.
      </p>

      <div className="floor-plan-page__grid">
        {FLOOR_PLANS.map((plan) => (
          <figure key={plan.id} className="floor-plan-page__card">
            <figcaption>{plan.title}</figcaption>
            <a href={plan.src} target="_blank" rel="noreferrer">
              <img src={plan.src} alt={plan.alt} />
            </a>
          </figure>
        ))}
      </div>

      <p className="floor-plan-page__source">
        Source:{' '}
        <a
          href="https://www.marriott.com/en-us/hotels/cltws-sheraton-charlotte-hotel/events/"
          target="_blank"
          rel="noreferrer"
        >
          marriott.com · Sheraton Charlotte · Events
        </a>
      </p>
    </section>
  );
}

export { FLOOR_PLANS };
