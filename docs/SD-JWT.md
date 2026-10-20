# SD-JWT VC configuratie op de Yivi server

Dit document beschrijft hoe SD-JWT VC issuance is geconfigureerd op de IRMA/Yivi server in dit project.

## Vereisten

- IRMA server (irmago) versie **≥ 0.19**
- Een X.509 issuer certificaat (PEM)
- De bijbehorende private key (PEM)
- De secrets opgeslagen in AWS Secrets Manager

## Configuratie-onderdelen

### 1. Configuration.ts

De `sdjwtvcIssuerId` property bepaalt of SD-JWT VC issuance is ingeschakeld voor een omgeving. Wanneer deze is ingesteld, worden de bijbehorende environment variables en secrets doorgegeven aan de container.

| Omgeving   | Issuer ID            |
|------------|----------------------|
| Acceptance | `irma-demo.gemeente` |
| Productie  | `pbdf.gemeente`      |

### 2. irma_config.json

De IRMA server config bevat een `sdjwtvc` sectie die de paden naar de certificaten en private keys definieert:

```json
"sdjwtvc": {
  "issuer_certificates_dir": "/storage/irma/sdjwtvc/certs",
  "issuer_private_keys_dir": "/storage/irma/sdjwtvc/privkeys"
}
```

### 3. AWS Secrets Manager

De volgende secrets moeten bestaan in het doelaccount:

| Secret path                                  | Inhoud                    |
|----------------------------------------------|---------------------------|
| `/yivi-brp-issue/container/sdjwtvc-cert`     | Issuer certificaat (PEM)  |
| `/yivi-brp-issue/container/sdjwtvc-private-key` | Issuer private key (PEM) |

De secrets moeten versleuteld zijn met de KMS key waarnaar verwezen wordt in de SSM parameter `Statics.ssmProtectionKeyArn`.

### 4. Container startup

Het script `irma_config_steps.sh` schrijft de secrets naar het filesystem:

- Certificaat → `/storage/irma/sdjwtvc/certs/{SDJWTVC_ISSUER_ID}.pem`
- Private key → `/storage/irma/sdjwtvc/privkeys/{SDJWTVC_ISSUER_ID}.pem`

De bestandsnaam moet overeenkomen met de issuer identifier zoals gedefinieerd in het scheme.

## In- en uitschakelen (feature flag)

SD-JWT VC issuance wordt aangestuurd door de `sdjwtvcIssuerId` property in `src/Configuration.ts`. Dit werkt als feature flag:

- **Inschakelen**: stel `sdjwtvcIssuerId` in op de juiste issuer identifier (bijv. `'pbdf.gemeente'`).
- **Uitschakelen**: verwijder de property of zet deze op `undefined`.

Wanneer `sdjwtvcIssuerId` niet is ingesteld:

1. De secrets `SDJWTVC_CERT` en `SDJWTVC_PRIVATE_KEY` worden niet aan de container doorgegeven
2. De environment variable `SDJWTVC_ISSUER_ID` wordt niet gezet
3. Het startup-script schrijft geen cert/key bestanden naar het filesystem
4. De IRMA server valt terug op alleen Idemix credential issuance

Na het wijzigen is een nieuwe deployment nodig om de wijziging door te voeren.

## Troubleshooting

| Symptoom | Mogelijke oorzaak |
|----------|-------------------|
| SD-JWT VCs worden niet geissued, alleen Idemix | `sdjwtvc` sectie mist in irma_config.json, of cert/key bestanden ontbreken |
| Server start niet op | Cert of private key is geen geldig PEM, of bestandsnaam matcht niet met scheme |
| `sdJwtBatchSize` wordt genegeerd | IRMA server versie is ouder dan 0.19 |
