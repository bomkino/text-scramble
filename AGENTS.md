# Agent guidance

Read the repository README and existing package scripts before changing code.

Keep secrets out of Git. Use environment variables and document required names in `.env.example` when needed. Do not commit provider credentials, deployment tokens, or generated deployment state.

Prefer small, reviewable changes. Preserve existing project structure and scripts. Run the repository's documented checks before handoff.

This repository is prepared for cloud development, but no framework, cloud provider, runtime, or deployment target is fixed unless documented in the repository. Record those decisions here or in the README when made.
