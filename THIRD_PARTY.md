# Third-party dependencies

All dependencies are imported through npm. Do not remove copyright/license notices from dependencies.

Before public release generate a current Software Bill of Materials (SBOM) and run:

```sh
npm ls --all
npm audit
npm view express license
npm view socket.io license
npm view google-auth-library license
npm view jsonwebtoken license
npm view helmet license
npm view express-rate-limit license
npm view dotenv license
```

No WorkAdventure engine, sample map, logo, or code is bundled.

Web browser loads two external resources: Google Identity Services SDK (`accounts.google.com`) and Socket.IO client served by the locally installed package. Add an explicit CSP appropriate to deployed resources before production.
