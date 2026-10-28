# שם המשחק milestones

Last updated 28 October 2026. These describe the verified state of the project, not the larger product roadmap.

| Milestone | Status | Evidence and remaining work |
| --- | --- | --- |
| Product foundation | Done | The implementation plan, project scaffold, reproducible official-data importer and 2,431-name initial catalog are in the repository. |
| Playable local experience | Done | Search setup, discovery, decisions and undo, saved/passed lists, custom names, numerology, tournament and local persistence are implemented. A browser walkthrough and domain tests cover the core flow. |
| Local editing and recovery | In progress | Catalog, recommendation weights and settings can be edited locally and exported; profile backups can be exported and imported. A shared authenticated admin, server-side publication, audit history and rollback still need implementation. |
| Free hosting | In progress | A password-protected temporary Netlify preview is live. Claiming it and connecting a permanent deploy workflow remain outstanding. The preview may lag the latest local changes. |
| Recoverable accounts and partner matching | In progress | A manual shortlist-file comparison works locally. Account-based synchronization and automatic partner pairing are not implemented. |
| Launch and future features | Planned | Verify a hosted deployment, broader mobile/accessibility behavior, payment/ad integration if chosen, and a safe release and backup process. Pet names remain a future addition. |

The original [implementation plan](implementation-plan.md) describes the wider target, including authenticated management and later features. It is not evidence that those features have already shipped.
