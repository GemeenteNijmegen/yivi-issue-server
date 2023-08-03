#!/bin/sh

echo "Updating irma_config.json file"
echo $IRMA_GW_URL
sed -i -e "s/IRMA_TOKEN/$IRMA_TOKEN/g" /storage/irma/irma_config.json
sed -i -e "s/IRMA_GW_URL/https:\/\/$IRMA_GW_URL/g" /storage/irma/irma_config.json

echo "$IRMA_GEMEENTE_PRIVKEY" > /storage/irma/privatekeys/pbdf.gemeente.xml

echo "Starting irma server with custom config file"
irma server --config /storage/irma/irma_config.json