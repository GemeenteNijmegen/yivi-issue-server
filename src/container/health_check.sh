# Ugly health check based on a 400 response of url below
wget http://localhost:8080/irma/session/123/frontend/status -q -O - > /dev/null 2>&1
if [ $? -eq 8 ] 
then
  exit 0
fi
exit 1