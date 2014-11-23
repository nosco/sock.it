# Remaining issues with Sock.it

### Lost messages
If pollTTL is brought down to 5, it triggers a rather curious bug.

Some messages don't get through - the issue seems to be, that node.js doesn't see the connection as broken and sends the message anyways - nobody knows it's lost!

Leaving it for now, as this seems to be only triggered by the abort, which is not all to bad, when having TTL of 25.
It seems to happen, when things happen in this order:
* Client opens poll connection
* Server accepts poll connection
* ~24 seconds go by
* Server starts to send a big message
* Client aborts
* Server doesn't notice
* Message is lost!


When a poll-msg gets a poll-start, it needs to put the message back into the queue.
This can happen, when the server restarts/dies, then it will get a new connId and a poll-start.

For a bit more speed, remove debug...

Is there still an issue with closed websockets?..

