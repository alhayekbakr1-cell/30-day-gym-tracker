# GitHub skills and engineering references

Research performed on 10 October 2026. The upstream instructions and selected supporting rules were reviewed before the source ZIP arrived. They were used as references; no third-party skill package, repository script, or application dependency was installed in this project. Persistent skill installation was unavailable in this session. These are default-branch references, not commit-pinned vendored dependencies.

| Source | What informed this implementation |
| --- | --- |
| [Vercel web design guidelines](https://github.com/vercel-labs/agent-skills/tree/main/skills/web-design-guidelines) | Explicit save feedback, labeled controls, input validity, keyboard focus, and a skip link. Visual accessibility still needs a browser audit. |
| [Vercel React best practices](https://github.com/vercel-labs/agent-skills/tree/main/skills/react-best-practices) | Versioned browser storage, pure state transformations, fewer writes, and explicit request sequencing. |
| [Vercel composition patterns](https://github.com/vercel-labs/agent-skills/tree/main/skills/composition-patterns) | Extracting sync, timers, backup validation, and session rules from the large workout component. |
| [Anthropic frontend design](https://github.com/anthropics/skills/tree/main/skills/frontend-design) | Keeping the established typography and forest/cream palette while making the workout task more prominent. No visual redesign is claimed without screenshots. |
| [Anthropic webapp testing](https://github.com/anthropics/skills/tree/main/skills/webapp-testing) | End-to-end flow selection and verification boundaries. Browser execution was blocked in this environment. |
| [Addy Osmani frontend UI engineering](https://github.com/addyosmani/agent-skills/tree/main/skills/frontend-ui-engineering) | State ownership, empty/loading/error states, and reversible data operations. |

## Selective adoption

The upstream local-storage migration example in Vercel's [schema rule](https://github.com/vercel-labs/agent-skills/blob/main/skills/react-best-practices/rules/client-localstorage-schema.md) catches replacement-write failures before removing an old key. Our review identified a possible loss of the original record if removal then succeeds. This implementation keeps unreadable recovery data and explicitly tests storage failures.

The testing skill prescribes network-idle waiting, whereas [Playwright's API documentation](https://playwright.dev/docs/api/class-page#page-wait-for-load-state) discourages relying on it for test readiness. Remaining browser checks should use visible controls and assertions about actual save state.

An illustrative dialog in the Addy Osmani skill did not implement the complete modal lifecycle. Backup restoration here uses an inline review region with native controls, rather than adopting that example.

[Impeccable](https://github.com/pbakaus/impeccable), [Dexie](https://github.com/dexie/Dexie.js), and [wger](https://github.com/wger-project/wger) were also evaluated at repository-overview level. Impeccable remains a candidate skill, Dexie a possible later storage upgrade, and wger a product reference. Their internals were not audited or copied. The current data model did not require adding a dependency to deliver these fixes.

Primary behavior references: [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [Web Storage API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), and [React useEffect](https://react.dev/reference/react/useEffect).
