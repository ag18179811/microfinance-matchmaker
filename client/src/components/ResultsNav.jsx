import { useEffect, useState } from 'react';

// A slim sticky bar under the header with jump links to the main results
// sections and a scroll-spy active state. Sections that didn't render are
// skipped (their anchor won't be in the DOM).

const SECTIONS = [
  { id: 'standing', label: 'Where you stand' },
  { id: 'raise', label: 'Raise your score' },
  { id: 'fundingplan', label: 'Funding plan' },
  { id: 'applications', label: 'Your applications' },
  { id: 'story', label: 'Funding story' },
  { id: 'prep', label: 'Prep documents' },
  { id: 'lenders', label: 'Programs' },
];

export default function ResultsNav() {
  const [present, setPresent] = useState([]);
  const [active, setActive] = useState(null);

  useEffect(() => {
    // which anchors actually have rendered content (some wrappers stay empty
    // when their lazy section returns null)
    const check = () =>
      setPresent(
        SECTIONS.filter((s) => {
          const el = document.getElementById(s.id);
          return el && el.offsetHeight > 24;
        })
      );
    check();
    const t = setInterval(check, 1500);
    setTimeout(() => clearInterval(t), 12000);

    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-90px 0px -70% 0px' }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    // re-observe as sections appear
    const reobs = setInterval(() => {
      SECTIONS.forEach((s) => {
        const el = document.getElementById(s.id);
        if (el) io.observe(el);
      });
    }, 2000);
    setTimeout(() => clearInterval(reobs), 12000);

    return () => {
      clearInterval(t);
      clearInterval(reobs);
      io.disconnect();
    };
  }, []);

  if (present.length < 3) return null;

  function jump(e, id) {
    e.preventDefault();
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <nav className="results-nav" aria-label="Results sections">
      <div className="results-nav-inner">
        {present.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className={active === s.id ? 'is-active' : ''}
            onClick={(e) => jump(e, s.id)}
          >
            {s.label}
          </a>
        ))}
      </div>
    </nav>
  );
}
