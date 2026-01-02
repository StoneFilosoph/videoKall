FROM coturn/coturn:latest

# Copy config as template (entrypoint will modify a copy)
COPY turnserver.conf /etc/turnserver.conf.template
COPY turnserver.conf /etc/turnserver.conf

# Copy entrypoint with execute permissions (--chmod requires BuildKit)
COPY --chmod=755 entrypoint.sh /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
