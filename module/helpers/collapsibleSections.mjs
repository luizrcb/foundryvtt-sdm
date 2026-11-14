/**
 * Collapsible sheet sections (counters, roll triggers): the chevron or the title in the section's header folds it.
 * The state is kept per sheet while it is open (re-renders keep it).
 */
export function bindCollapsibleSections(app) {
  app._sdmCollapsed ??= new Set();
  app.element.querySelectorAll('[data-collapse-key]').forEach(section => {
    const key = section.dataset.collapseKey;
    section.classList.toggle('collapsed', app._sdmCollapsed.has(key));
    const chevron = section.querySelector(':scope > header .sdm-collapse-toggle');
    // The chevron and the section's title (not the whole header line) fold it
    const toggle = chevron?.closest('strong') ?? chevron;
    if (!toggle || toggle.dataset.bound) return;
    toggle.dataset.bound = '1';
    toggle.classList.add('sdm-collapse-title');
    toggle.addEventListener('click', event => {
      event.preventDefault();
      event.stopPropagation();
      const collapsed = section.classList.toggle('collapsed');
      if (collapsed) app._sdmCollapsed.add(key);
      else app._sdmCollapsed.delete(key);
    });
  });
}
