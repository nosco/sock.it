### Known issues with Sock.it

HA Proxy and the likes, can trigger a problem, due to connections not being closed correctly in both ends, when one end is closed.

For HA Proxy 1.5+ the fix is to use:

	option http-server-close
	option forceclose

At some point, a script may be created that can test the issue, but this is the basics of the problem:

Abort is called on an XMLHTTP connection, this should trigger some events in node.js, which then knows, the connection is no longer.

When the issue is present (i.e. HA Proxy not having about conf), those events isn't triggered, because HA Proxy keeps the server connection alive.


### Remaining issues with Sock.it

* Create the code for handling binary data

### Other stuff

For a bit more speed, remove debug...

Is there still an issue with trying to send to closed websockets?..
