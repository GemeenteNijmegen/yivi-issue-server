#!/bin/sh

echo "Setting up irma directory"
mkdir /storage/irma
mkdir /storage/irma/irma_configuration

echo "Updating irma_config.json file"
cp /tmp/irma_config.json /storage/irma/irma_config.json
sed -i -e "s/IRMA_TOKEN/$IRMA_TOKEN/g" /storage/irma/irma_config.json
sed -i -e "s/IRMA_GW_URL/https:\/\/$IRMA_GW_URL/g" /storage/irma/irma_config.json

mkdir /storage/irma/privatekeys
echo "$IRMA_GEMEENTE_PRIVKEY" > /storage/irma/privatekeys/pbdf.gemeente.xml

echo "Setting up SD-JWT VC directories"
mkdir -p /storage/irma/sdjwtvc/certs
mkdir -p /storage/irma/sdjwtvc/privkeys

if [ -n "$SDJWTVC_CERT" ]; then
  echo "$SDJWTVC_CERT" > /storage/irma/sdjwtvc/certs/${SDJWTVC_ISSUER_ID}.pem
fi

if [ -n "$SDJWTVC_PRIVATE_KEY" ]; then
  echo "$SDJWTVC_PRIVATE_KEY" > /storage/irma/sdjwtvc/privkeys/${SDJWTVC_ISSUER_ID}.pem
fi

echo "Starting irma server with custom config file"
irma server --config /storage/irma/irma_config.json
