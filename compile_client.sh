#!/bin/bash
echo -e "(function() {\n" > browser/client.js;
cat lib/browser/debug.js >> browser/client.js;
cat lib/browser/function.bind.js >> browser/client.js;
cat lib/browser/xhr.js >> browser/client.js;
cat lib/browser/poll.js >> browser/client.js;
cat lib/browser/sockit.js >> browser/client.js;
echo -e "\nwindow.SockIt = SockIt;\n})();\n" >> browser/client.js;
uglify -s browser/client.js -o browser/client.min.js
