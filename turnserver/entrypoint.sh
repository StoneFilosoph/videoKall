#!/bin/sh

# Replace environment variables in config
CONFIG_FILE="/etc/turnserver.conf"
TEMP_FILE="/tmp/turnserver.conf"

# Copy original config to temp (to avoid appending on restart)
cp /etc/turnserver.conf.template $TEMP_FILE 2>/dev/null || cp $CONFIG_FILE $TEMP_FILE

# Update realm
if [ -n "$TURN_REALM" ]; then
	sed -i "s|^realm=.*|realm=$TURN_REALM|" $TEMP_FILE
fi

# Update user credentials (using | as delimiter to handle special chars)
if [ -n "$TURN_USERNAME" ] && [ -n "$TURN_PASSWORD" ]; then
	sed -i "s|^user=.*|user=$TURN_USERNAME:$TURN_PASSWORD|" $TEMP_FILE
fi

# Add external IP if provided (only if not already present with same value)
if [ -n "$EXTERNAL_IP" ]; then
	# Remove any existing external-ip lines first
	sed -i '/^external-ip=/d' $TEMP_FILE
	echo "external-ip=$EXTERNAL_IP" >> $TEMP_FILE
fi

# Move temp config to final location
cp $TEMP_FILE $CONFIG_FILE

# Start turnserver
exec turnserver -c $CONFIG_FILE
