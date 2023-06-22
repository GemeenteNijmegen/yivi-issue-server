#!/bin/sh

echo "Updating irma_config.json file"
echo $IRMA_GW_URL
sed -i -e "s/IRMA_TOKEN/$IRMA_TOKEN/g" /usr/local/share/irma/irma_config.json
sed -i -e "s/IRMA_GW_URL/https:\/\/$IRMA_GW_URL/g" /usr/local/share/irma/irma_config.json

echo "$IRMA_GEMEENTE_PRIVKEY" > /usr/local/share/irma/privatekeys/pbdf.gemeente.xml
#echo "$IRMA_GEMEENTE_PRIVKEY1" > /usr/local/share/irma/privatekeys/pbdf.gemeente.1.xml

echo "Starting irma server with custom config file"
irma server --config /usr/local/share/irma/irma_config.json