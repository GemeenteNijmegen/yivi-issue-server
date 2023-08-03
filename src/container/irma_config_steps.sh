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

echo "Starting irma server with custom config file"
irma server --config /storage/irma/irma_config.json