# openai call functions

## Functions available :
- current time in a city
- weather forecast in a city 
- start and stop date ( mostly for database queries )

### Get your openweathermap here https://openweathermap.org/ as OPENWX_API_KEY
### Get your openai APIKEYS from https://openai.com

## Call with below URL
```
curl -X POST http://localhost:5050/ask -H 'Content-Type: application/json' -d '{ "prompt": "What is the weather forecast in Kuala Lumpur ?" }'
```
