# שם המשחק milestones

Last updated 28 October 2026. These describe the verified state of the project, not the larger product roadmap.

| Milestone | Status | Evidence and remaining work |
| --- | --- | --- |
| Product foundation | Done | The implementation plan, project scaffold, reproducible official-data importer and 2,431-name initial catalog are in the repository. |
| Playable local experience | Done | Search setup, discovery, decisions and undo, saved/passed lists, custom names, numerology, tournament and local persistence are implemented. Automated desktop and phone browser checks cover the core flow and tournament recovery; domain tests cover additional rules. |
| Editing and recovery | In progress | Local catalog and settings editing is working. Optional authenticated publishing, revision history and account backups are implemented; authorization policies pass local PostgreSQL tests, but a real Supabase project and end-to-end verification are still required. |
| Free hosting | Done | GitHub Pages publishes the public repository with an automated build. The hosted site returned HTTP 200, and a phone-sized browser check saved a name and recovered it after reload. |
| Recoverable accounts and partner matching | In progress | Manual shortlist-file comparison works locally. Optional account backup is implemented but not connected or tested against a hosted project; automatic partner pairing remains planned. |
| Launch and future features | Planned | Verify a hosted deployment, broader mobile/accessibility behavior, payment/ad integration if chosen, and a safe release and backup process. Pet names remain a future addition. |

The original [implementation plan](implementation-plan.md) describes the wider target, including authenticated management and later features. It is not evidence that those features have already shipped.
