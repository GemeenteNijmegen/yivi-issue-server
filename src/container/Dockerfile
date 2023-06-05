# BUILD IMAGE
FROM alpine:3 as getter

ARG IRMA_VERSION
ARG IRMA_CHECKSUM
 
RUN wget -q -O /irma https://github.com/privacybydesign/irmago/releases/download/${IRMA_VERSION}/irma-linux-amd64 && \
    echo "${IRMA_CHECKSUM}  /irma" | sha256sum -c && \
    chmod 0755 /irma && \
    /irma version

# CONTAINER IMAGE
FROM alpine:3

ARG BUILD_FOR_ENVIRONMENT

COPY --from=getter /irma /usr/local/bin/irma 

RUN addgroup -S irma
RUN adduser -H -D -S -G irma irma

RUN apk --no-cache add ca-certificates
 
RUN install -d -o irma -g irma -m 0755 /usr/local/share/irma && \
    install -d -o irma -g irma -m 0755 /usr/local/share/irma/irma_configuration && \
    install -d -o irma -g irma -m 0755 /usr/local/share/irma/privatekeys

COPY irma_config_steps.sh /tmp/irma_config_steps.sh 
COPY health_check.sh /tmp/health_check.sh
COPY irma_config_${BUILD_FOR_ENVIRONMENT}.json /usr/local/share/irma/irma_config.json
RUN chmod +x /tmp/irma_config_steps.sh 
USER irma
ENTRYPOINT ["/tmp/irma_config_steps.sh"] 
