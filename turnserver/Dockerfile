FROM coturn/coturn:latest

# Switch to root for setup
USER root

# Copy config as template (entrypoint will modify a copy)
COPY turnserver.conf /etc/turnserver.conf.template
COPY turnserver.conf /etc/turnserver.conf

# Copy entrypoint script, fix line endings (Windows CRLF -> Unix LF), set permissions
COPY entrypoint.sh /tmp/entrypoint.sh
RUN tr -d '\r' < /tmp/entrypoint.sh > /usr/local/bin/entrypoint.sh && \
    chmod +x /usr/local/bin/entrypoint.sh && \
    rm /tmp/entrypoint.sh

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
