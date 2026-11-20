<!-- coderabbit-ai-generated:v1 -->

# Application deployment

The client is a React/Vite application served by the root Cloudflare Worker (`src/worker.ts`). Deploy the Worker and its built `dist` assets together. A static host alone cannot run the database, registry, or collector APIs.

## Requirements

- Node 24 or newer and npm. Use the committed `package-lock.json` with `npm ci`.
- Cloudflare access to the D1 database and KV namespace configured in `wrangler.toml`. Their supplied IDs are configured; a local dry run does not verify account ownership or resource existence.
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f4e36bbe8b328e7de629334110952b4bb5a6a2d0230b4c5a6232ef3604983015 -->

- For Dashboard-based administrator access, configure the `ADMIN_PASSWORD` Worker secret with a strong, unique password. The Worker uses random server-side sessions in its `ADMIN_SESSIONS` Durable Object binding. Sessions expire after four hours and are revoked on logout. The root Worker includes a native login rate limiter of 10 attempts per minute per reported client IP. Existing `ADMIN_PASSWORD_HASH` and independent `JWT_SECRET` credentials are supported when `ADMIN_PASSWORD` is absent.

<!-- /coderabbit-ai-generated:v1 -->

## Prepare and deploy

```bash
npm ci
npm run typecheck
npm test
npm run build
npx wrangler deploy --dry-run
```

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:bddbecd18c05e4a9a964bb0638431a7f6e177a55e88db34dd7871a296fb1b8b5 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:2217684bf27a34a436e1f5744d4f38c62f262447de6ba97b9ea4928be53b81a1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:8fe8452a80b3398ea1b4f9d0de08b384f9f18bb150ac8e51b6bcff8b33c671a1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:4e1be724e16a7382d9cc4e786abf9b6419f29028a6a877d776c736c1c5ed0ca9 -->

### Public command center and operator sign-in

`/#/admin` opens the public overview. Choose **Operator sign-in** to enter your administrator password and open publishing; no username is required. The public view remains available when signed out. Private publishing, customer data, node administration and BEEMAX inference require an authorized session. The client verifies the server session after login and rechecks it on focus and every minute.

Configure `ADMIN_PASSWORD` as a Cloudflare Worker secret and retain `ADMIN_SESSIONS` with its existing migration. **If both password settings exist, `ADMIN_PASSWORD` takes precedence over `ADMIN_PASSWORD_HASH`.** <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:1caa71cb3755835ac9b4aee66cdc33df52646a97f8b5b1da04681aa9382e71f7 -->

Public sign-in displays only account-entry controls and concise errors. Configuration guidance belongs in these operator deployment instructions.

<!-- /coderabbit-ai-generated:v1 --> For legacy mode, remove `ADMIN_PASSWORD`, retain a valid 64-character hexadecimal `ADMIN_PASSWORD_HASH` and an independent `JWT_SECRET` of at least 32 bytes, and enter the original password rather than the hash. Invalid legacy hash configuration now reports a setup error instead of invalid credentials. No default password is embedded in the app.

Use Cloudflare → Workers & Pages → planetary-max → Settings → Variables and Secrets to correct the active setting, then deploy changes if prompted. Changing the Dashboard password invalidates existing sessions. Never share password values in chat or commit them. Local Preview credentials are synthetic and differ from production.

<!-- /coderabbit-ai-generated:v1 -->
<!-- /coderabbit-ai-generated:v1 -->
<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->

After reviewing the target Cloudflare account, apply all pending migrations to the real database and deploy:

```bash
npm run db:migrate
npm run deploy
```

In Cloudflare Workers Builds, use `npm run build` as the build command and `npx wrangler deploy` as the deploy command. Wrangler serves `./dist`. The built `dist` directory is ignored in Git; generate it during each build. SPA paths use the application shell, while `/api/*` and `/v1/*` reach the Worker first and keep JSON errors.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:c9505f7554340bbecfc5108b1ca0d30c00ca93ead0e4113e6d727359db84314e -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:9553e8cd319efb521b8017b24905ff2d86ba62bb1c3673e4726ad1def7515b23 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:11a23b2fbb8eaf2edb9916a06bbecb7bd1cd42bb3aeff1ef18951c1ef7073dad -->

Migrations 0016 through 0021 are required.

<!-- /coderabbit-ai-generated:v1 --> Migration 0018 adds the digital release catalog; 0019 adds optional video and screenshot previews; 0020 adds direct digital acquisitions, private delivery, edition inventory and ledger guards.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 --> Migration 0016 adds a catalog flag and hides the exact unchanged historical demo artwork records; it preserves the rows. Migration 0017 links new settlement receipts to paying wallets for access-link recovery. Back up the production database before migration. No remote migration or deployment was performed during this task.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:d8765afb2c81ec13c3954c24c6831cd3244fa0f941fac0a6c7cdddf4abc301bd -->

## Ecosystem publishing and BEEMAX

The existing app is extended in place; see [specification coverage](docs/ECOSYSTEM.md) for implemented capabilities and remaining infrastructure requirements. Do not reset production data or rewrite existing Durable Object migration tags for this update.

In Cloudflare Builds, select the repository root and the branch containing this update. Use `npm run build` and `npx wrangler deploy --config ./wrangler.toml`. The nested `workers/beemax-core` configuration uses the same Worker name and must not be selected for the showroom.

Apply the new additive D1 migration after inspecting the target account:

```bash
npx wrangler d1 migrations apply planetary-max-db --remote --config ./wrangler.toml
```

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:9a8e983c529f56740a3d8f720035556f7c263e8bd2583b06b53cdbe762fae626 -->

Root configuration includes `AI` (Workers AI) and `BEEMAX_LIMITER`, in addition to the existing administrator-session binding. BEEMAX uses the owner's Workers AI account and requires no model key in browser code. Its live availability and usage limits must be checked in that account after deployment. The assistant supports conversation; it does not execute commands, publish, or transfer money.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:32e21437a07ac80949b8aabce86a0f60f7a4f915a6f6e6dd14c50b5fd338cc2d -->

In the private HUD, the research assistant and `/research` command summarize configured RSS, Atom, or JSON feeds. Use `/web <query>` for explicit web search through the authenticated `/api/hud/web-query` endpoint. Set the server secret with `npx wrangler secret put BEEMAX_WEB_SEARCH_API_KEY` using a Brave Search API key. Only the explicit query is sent to Brave; results are excerpts and source URLs without AI synthesis. Missing configuration fails closed. Web lookup requires AdminSessionDO, a same-origin POST, and BEEMAX_LIMITER; MAX Compute stays `0.000000`. It never reads configured feeds or KV caches, and responses use `Cache-Control: no-store`. Ordinary prompts keep using the authenticated assistant. See https://api-dashboard.search.brave.com/documentation/services/web-search.

<!-- /coderabbit-ai-generated:v1 --> Set `PUBLIC_FEEDS_JSON` to an array of objects with HTTPS `url`, `label`, and `scope` fields; optionally set `PRIVATE_WWW_FEED_URL` and the `PRIVATE_WWW_FEED_TOKEN` secret. Private feeds are only read after an AdminSessionDO check. Research needs at least one available feed item and the Workers AI binding. These feeds are configured sources, not an unrestricted web search; source material is treated as untrusted. The HUD video player accepts direct HTTPS video or HLS URLs; stream availability and CORS depend on the video host.

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7ec7ff86e4b19b0e8ea1da1dc8ccf461d67008744a51d67e83702b1c125771b4 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ae3c007b8cf53a701d67e08062f73bbbd0d4328d22f4b4d8bcf471307cc2beac -->

In an authenticated operator session, open Publishing desk → Games, apps & media. Save a draft, then publish it when its cover and content are ready. Add an optional direct HTTPS video URL (a browser-playable file, not a video-platform page) and up to 12 HTTPS screenshot URLs, one per line. Games/apps appear at `/#/games`; media at `/#/media`. Both have a trailer showroom and immersive image gallery. Use Edit release to revise or archive a publication.

Free publications require a launch URL. Paid publications require a private HTTPS/IPFS collector asset URL, its SHA-256 digest, and a finite edition count. USD/USDC priced releases can use the existing Base USDC verification flow. DAT prices remain catalog metadata until a DAT network is defined. The publisher supplies the asset digest; the Worker does not verify copyright or fetch the file to recompute it.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:0c778436220a8d6ec1fd311684980bd59e8a2bb241bca582ff411f122b70e699 -->

Apply migrations 0018–0021 before deploying this code. Migration 0021 adds protected-delivery declarations and payment refund review records.

<!-- /coderabbit-ai-generated:v1 --> Migration 0019 adds previews. Migration 0020 adds direct digital orders, private delivery and edition fields, global receipt claims and audit guards. It preserves existing records and registry history. Existing paid catalog links are retained privately but no longer used as external purchase buttons. Older paid releases need private delivery and digest fields before native acquisition is available; free releases keep their launch destination. <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:72023dd449e5054feac0156a8892abed320db6e654aa28879ec067b4f90b945c -->

The public digital catalog never returns paid destinations, collector URLs or paid asset hashes. A raw SHA-256 content digest can reveal a public IPFS CID, so hashes are kept in the protected operator and collector views. Paid assets must be encrypted or stored behind access controls on the asset host; public IPFS content must be encrypted. The publishing form requires this protection declaration. A hidden URL alone is not access control; operators must actually configure the selected protection and arrange secure key delivery for encrypted files.

<!-- /coderabbit-ai-generated:v1 -->

Paid release acquisition verifies an already submitted Base transfer and an EOA wallet signature. Inventory is not reserved before payment: buyers must confirm availability with the publisher before sending funds. <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:ad2803940f0e63960ee2edfe27150db2947cdad8f6ac31d3b11a903025cf9545 -->

There is no escrow, automatic refund, wallet payment submission or multisignature release. Verified digital transfers that cannot acquire an edition (including sold-out or partial payments) receive a persistent refund review case instead of being lost. Cases globally claim the original receipt and appear in Publishing desk → Payment recovery. The publisher returns funds manually from the recorded treasury; the app verifies a confirmed full refund of the recorded token to the original paying wallet before resolving the case. Buyers can resubmit the original transaction and wallet proof to check progress, even when new checkout is disabled. Concurrent purchases retry available editions while preserving price and asset guards.

<!-- /coderabbit-ai-generated:v1 --> The same transaction cannot acquire both an artwork and a digital edition. Digital orders atomically claim a receipt, allocate an edition and record an audit event. A SHA-256 settlement record binds the buyer wallet, receipt, amount and asset digest; it is not a blockchain token or legal ownership attestation. Use the issued collector vault link, or resubmit the same receipt with the paying wallet to recover access. Sold-out published releases retain a recovery form. Delivery snapshots survive later catalog edits or archival.

The publishing desk shows recent verified digital acquisitions. D1 triggers reject updates/deletes of new digital orders, receipt claims and ledger events. Edition supply becomes fixed after its first digital acquisition. Publication, deletion, inventory and settlement changes add ledger events. This is application-level append-only enforcement; database administrators can alter the schema. Historical actions are not reconstructed. Full Ethereum EIP-712 escrow, an N-of-M signer policy and identity-linked provenance still require a deployed audited contract, defined roles and a payment network.

<!-- /coderabbit-ai-generated:v1 -->
## Populate the application

<!-- /coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:f93212503d26fc31b1298c8013f68e3119821033f894aa75e82d27aca79a5ea6 -->

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:7e6598b0c01409ef62000df1ad145057ee5cfdc628f4e60a66feeada1368cc13 -->

1. Open `/#/admin` (or `/admin`) and choose Operator sign-in to access the publishing desk. Anonymous visitors see the public command center.

<!-- /coderabbit-ai-generated:v1 -->

<!-- /coderabbit-ai-generated:v1 -->
2. In Publishing desk, create an artist profile and publish each real artwork. Supply an image URL, its actual SHA-256 asset digest, medium, dimensions, and USD price in cents. The stored digest is metadata, not an ownership certificate.
3. Image hosts must allow cross-origin texture loading for the WebGL gallery. Ordinary image detail views remain available when textures or WebGL cannot load.
4. Publish sports research with the real matchup, pick, confidence, and number of sources. These are operator-authored records. There is no live scores, odds, tracking, or sports provider integration in this release.
5. Enroll real node identities with their Ed25519 public keys. Private signing keys stay on the nodes. Revoke trust from the registry when necessary.

The public pages show database records and honest empty/error states. They no longer substitute illustrative art, simulated odds, invented motion readings, or sample node counts. The former `#/spaces` branch and finance simulation endpoints are outside the released application flow.

## Node heartbeats

An enrolled active node can POST `{ "mesh_region": "its-region" }` to `/api/beemax/heartbeat`. Sign the exact raw request using the existing protocol documented in `server/middleware.ts`: timestamp, nonce, method, path/search, and lowercase SHA-256 body digest, joined with newline characters. Include `X-Max-Node-Id`, `X-Max-Node-Signature`, `X-Max-Timestamp`, and `X-Max-Nonce`. Reused nonces are rejected. The command center displays persisted trust and heartbeat data; it does not invent network links or infer an active connection from trust status.

## Optional collector payments

Configure `RPC_URL`, `USDC_CONTRACT`, and `TREASURY_WALLET` on the Worker for Base mainnet only. Set each digital work's private HTTPS/IPFS collector asset URL when publishing. `PUBLIC_APP_URL` controls receipt links; `RESEND_API_KEY` enables email attempts, but a verified sender address must also replace the existing email sender before production email is usable.

A buyer must use the EOA wallet that paid and sign the site/artwork/transaction-bound access message. The Worker verifies the signature, chain, receipt, transfer recipient, amount, and confirmations before saving an atomic sale and unique receipt. A transaction hash alone is rejected. Signed retries can recover the access link for new receipts. Contract-wallet signatures and automatic wallet payment submission are not implemented. The client opens a protected collector vault after successful verification. Chain settlement and delivery require independent production verification; tests used synthetic receipts and no funds.

## Compatibility changes

- Artwork, sports, and chess record writes now require administrator authentication and same-origin requests. Public reads remain available.
- `/api/admin/login` establishes an HttpOnly, SameSite cookie. It no longer returns the bearer token to browser JavaScript. Existing integrations must adapt; authorized bearer tokens remain accepted by protected endpoints.
<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:8bb1b85f6ec64aa0882291653a4299986556d6c7d79d68321ffd0202634b29ca -->

- Legacy JWT mode requires an independent signing secret and never uses the password hash as a signing-secret fallback. Dashboard password mode uses independent opaque server-side sessions instead of JWTs.

<!-- /coderabbit-ai-generated:v1 -->
- Historical finance demo endpoints are no longer mounted on the root Worker. Their source/tests remain historical reference.
- The root Worker no longer declares placeholder `SESSION_KV` or unused AI bindings. The separate `workers/beemax-core` authentication flow and `portal-os` deployment retain their own configuration requirements.

## Local preview

Create an ignored `.dev.vars` with local administrator secrets, then run:

```bash
npm run db:migrate:local
npm run build
npm run preview:worker -- --ip 0.0.0.0
```

The preview serves built assets and local D1/KV storage at port 8787. After frontend edits, rebuild. `npm run dev` is available for Vite development; its API proxies target the same root Worker on port 8787.

<!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:b40d68b5037384ee36befe9ff9bfe8383c24d8fb4a8e14c788e52fa5e6679385 -->

## Client deployment notes

Apply pending D1 migrations before deploying. Migration `0029_hide_original_demo_artworks.sql` hides unchanged, unpurchased records from the original demo seed while preserving all artwork rows; edited and purchased records remain visible. Review the target database and its recovery point first.

Keep the Base USDC settlement recipient stable while submitted payments await verification. <!-- coderabbit-ai-generated:v1 -->

<!-- coderabbit-ai-generated-section:v1:04053733bf493b9dc9ee9bd74ee9e4755c27f8b4cbdf3f984d843084e10a833b -->

Receipt verification uses the currently configured recipient; changing it before the first successful verification prevents that payment from being verified automatically.

<!-- /coderabbit-ai-generated:v1 --> A verified receipt can be retried after a destination change. Treasury release records are bookkeeping only and do not send funds.

## Outstanding release verification

<!-- /coderabbit-ai-generated:v1 -->

- Provide and publish real inventory and sports research, or specify a licensed sports provider for integration.
- Verify production Cloudflare resources, secrets, migrations, and deployment.
- Verify WebGL rendering, orbit/zoom, and fullscreen on supported client devices. The shared task browser had WebGL disabled; keyboard/2D chess and image fallback were verified.
- Complete funded checkout and collector delivery verification only with explicit authorization. Production checkout was not exercised.
- Full dependency audit still reports six high development dependency entries via picomatch; the latest published version observed was 4.0.7 and was included in the advisory range. The production-only dependency audit passed with zero vulnerabilities. Do not apply audit's suggested downgrades to older tooling without checking their separate advisories.
