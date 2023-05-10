# BUILD IMAGE
FROM alpine:3 as getter

# Inserted during build in the pipeline
#ARG IRMA_VERSION=v0.12.1
#ARG IRMA_CHECKSUM=d772b84c42379fed2a50ce3375ff14522e32dce38298a6797f496db0f5e1d373
 
RUN wget -q -O /irma https://github.com/privacybydesign/irmago/releases/download/${IRMA_VERSION}/irma-linux-amd64 && \
    echo "${IRMA_CHECKSUM}  /irma" | sha256sum -c && \
    chmod 0755 /irma && \
    /irma version

# CONTAINER IMAGE
FROM alpine:3
 
COPY --from=getter /irma /usr/local/bin/irma 

RUN addgroup -S irma
RUN adduser -H -D -S -G irma irma

RUN apk --no-cache add ca-certificates
 
RUN install -d -o irma -g irma -m 0755 /usr/local/share/irma && \
    install -d -o irma -g irma -m 0755 /usr/local/share/irma/irma_configuration && \
    install -d -o irma -g irma -m 0755 /usr/local/share/irma/privatekeys

COPY irma_config_steps.sh /tmp/irma_config_steps.sh 
COPY irma_config.json /usr/local/share/irma/irma_config.json 
RUN chmod +x /tmp/irma_config_steps.sh 
USER irma
ENTRYPOINT ["/tmp/irma_config_steps.sh"] 
