require("dotenv").config();
const axios = require('axios');
//const rateLimit = require('axios-rate-limit');
//const rateLimitedAxios = rateLimit(axios.create(), { maxRequests: 5, perMilliseconds: 1000 }); 

const { Spot } = require('@binance/connector')
const bin_apiKey = process.env.BINANCE_API_KEY
const bin_apiSecret = process.env.BINANCE_API_SECRET

const rapidAPI = process.env.RAPID_API

const binance = new Spot(bin_apiKey, bin_apiSecret)
// Examples here 
//https://github.com/binance/binance-connector-node/tree/master/examples

const express = require("express");
const app = express();
app.use(express.json());

const { Configuration, OpenAIApi, chatCompletion } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);
const port = process.env.PORT || 5050;


// return values should not have response.data 
async function runAllCityfunctions(city, iata, tz, wx_id) {

  // getAirportCode returned already formatted
  const iataRes = await getAirportCode(iata);
  console.log("iata city: ",iataRes.city)

  try {
    // Call the functions concurrently using Promise.all
    const results = await Promise.all([
      getAirQuality(city), 
      lookupTime(tz), 
      lookupWeather(wx_id),
    ]);

    let airquality = results[0]
    let timezone = results[1]
    let wx = results[2]

    //console.log("air: ", airquality)
    //console.log("tz: ", timezone)
    //console.log("wx: ",wx)

    // When all functions have completed, 'results' will be an array containing the resolved values
    //console.log(results); // ['Result from function 1', 'Result from function 2', 'Result from function 3']

    // format everything here before return needed results to gpt
    const { datetime } = timezone;
    const localTime = new Date(datetime).toLocaleTimeString(undefined,
    { hour: 'numeric', minute: 'numeric', hour12: true });

    const forecast = wx.weather[0].description
    const weather_code = wx.weather[0].id
    const temp = wx.main.temp
    const temp_min = wx.main.temp_min
    const temp_max = wx.main.temp_max
    const lat = wx.coord.lat
    const lon = wx.coord.lon

    console.log(weather_code, forecast, temp, temp_min, temp_max, lat, lon)


    let result2 = {}
    result2.input = city
    result2.name = iataRes.city
    result2.country = iataRes.country
    result2.iata = iata
    result2.airport = iataRes.name
    result2.localtime = localTime
    result2.tz = tz
    result2.PM25 = airquality.PM25.concentration
    result2.PM10 = airquality.PM10.concentration
    result2.forecastCode = weather_code
    result2.forecast = forecast
    result2.temp = temp
    result2.temp_min = temp_min
    result2.temp_max = temp_max
    result2.lat = lat
    result2.lon = lon

    return result2
    //return results;
  } catch (error) {
    console.error('An error occurred:', error);
    throw error;
  }
}

async function getAirportCode(iata) {
  const response = await axios.get(`https://api.api-ninjas.com/v1/airports?iata=${iata}`, {
    headers: {
      'X-Api-Key': rapidAPI
    },
    params: {}
  })

  console.log("getAirportCode: ", response.data)
  const data = response.data[0]

  return data
}

async function getAirQuality(city) {
  const response = await axios.get(`https://api.api-ninjas.com/v1/airquality?city=${city}`, {
    headers: {
      'X-Api-Key': rapidAPI
    },
    params: {}
  })

  //console.log(response.data)
  const data = response.data
  data.PM25 = data["PM2.5"]; // convert PM2.5 to PM25 removing the dot

  return data
}


async function lookupTime(location) {
  const response = await axios.get(`http://worldtimeapi.org/api/timezone/${location}`);
  
  //console.log("lookupTime: ", response.data)
  
  const { datetime } = response.data;
  const localTime = new Date(datetime).toLocaleTimeString(undefined,
    { hour: 'numeric', minute: 'numeric', hour12: true });
  //console.log(`Current time in ${location} in ${localTime}`)

  //return `current time in ${location} in ${localTime}`;
  return response.data
}

async function lookupWeather(id) {
  const response = await
    axios.get(`https://api.openweathermap.org/data/2.5/weather?units=metric&appid=${process.env.OPENWX_API_KEY}&id=${id}`);

  //console.log(response.data.weather[0].description)

  const forecast = response.data.weather[0].description
  const name = response.data.name
  const weather_code = response.data.weather[0].id
  const temp = response.data.main.temp
  const temp_min = response.data.main.temp_min
  const temp_max = response.data.main.temp_max
  //console.log(weather_code, forecast, temp, temp_min, temp_max)

  //return `curent weather in ${name} is ${forecast} with temperature of ${temp}`
  return response.data
}

async function getStartEndDate(startDate, endDate) {
  console.log(startDate, endDate)
  return `The startdate is ${startDate}, the enddate is ${endDate}`
}

async function lookupBinancePrice(coinPair) {
  const response = await binance.avgPrice(coinPair);
  //console.log(response.data)
  const coinPrice = response.data.price
  return `the average price of ${coinPair} is ${coinPrice}`
}

async function binanceLoanHistory(coinPair) {
  const response = await binance.loanHistory(coinPair);
  console.log("Response: ", response.data)
  const coinPrice = response.data
  return `the loan history ${coinPair} is ${coinPrice}`
}

app.post("/ask", async (req, res) => {
  const prompt = req.body.prompt;

  const param1 = {
    model: "gpt-3.5-turbo-0613",
    messages: [
      { role: "system", content: "You are a helpful assistance" },
      { role: "user", content: prompt }
    ],
    functions: [
      {
        name: "lookupTime",
        description: "get the current time in a given location",
        parameters: {
          type: "object",
          properties: {
            location: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "The location, e.g. London, England, but it should be written in a timezone name Asia/KualaLumpur"
            }
          },
          required: ["location"]
        }
      },
      {
        name: "lookupWeather",
        description: "get the current weather in a given location",
        parameters: {
          type: "object",
          properties: {
            location_id: {
              type: "number",
              // describe to chatGPT what format you need for the API calls
              description: "The city, e.g. New York, USA, but it should be written in a openweathermap city id format"
            },
            location_name: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "The city, e.g. New York, USA, but in format of city, country"
            }
          },
          required: ["location_id", "location_name"]
        }
      },
      {
        name: "lookupBinancePrice",
        description: "get the current crypto coin price pairs, default to USDT",
        parameters: {
          type: "object",
          properties: {
            coinpair: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "The crypto token or coin, e.g. Etherum USDT pair, should be written in ETHUSDT format"
            },
          },
          required: ["coinpair"]
        }
      },
      {
        name: "BinanceLoanHistory",
        description: "get the current crypto loan history",
        parameters: {
          type: "object",
          properties: {
            coin: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "The crypto token or coin, e.g. Binance, should be written in BNB format"
            },
          },
          required: ["coin"]
        }
      },
      {
        name: "getStartEndDate",
        description: "get the start and end date for a given time period",
        parameters: {
          type: "object",
          properties: {
            start_date: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "Get the start date, but it should be written in ISO 8601 Date String YYYY-MM-DD format"
            },
            end_date: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "Get the end date, but it should be written in ISO 8601 Date String YYYY-MM-DD format"
            },
          },
          required: ["start_date", "end_date"]
        }
      },
      {
        name: "getAirportCode",
        description: "get the airport codes in iata format",
        parameters: {
          type: "object",
          properties: {
            iata: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "Get the airport code in iata, example KUL for Kuala Lumpur airport, format should be IATA 3-character airport code"
            },
            
          },
          required: ["iata"]
        }
      },
      {
        name: "getCityData",
        description: "get details info for a city",
        parameters: {
          type: "object",
          properties: {
            city: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "Please provide the city name or city short form, and it will return the full name of the city."
            },
            iata: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "Get the airport code in iata, example KUL for Kuala Lumpur airport, format should be IATA 3-character airport code"
            },
            tz: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "The location, e.g. London, England, but it should be written in a timezone name Asia/KualaLumpur"
            }, 
            wx_id: {
              type: "number",
              // describe to chatGPT what format you need for the API calls
              description: "The city, e.g. New York, USA, but it should be written in a openweathermap city id format"
            },
            wx_city: {
              type: "string",
              // describe to chatGPT what format you need for the API calls
              description: "The city, e.g. New York, USA, but written in format of city name"
            }
            
          },
          required: ["city", "iata", "tz", "wx_id", "wx_city"]
        }
      },


    ],
    function_call: "auto"
  }


  try {
    if (prompt == null) {
      throw new Error("Uh oh, no prompt was provided");
    }

    // configure at top of page endpoint, params, headers
    const completion = await openai.createChatCompletion(param1)

    const completionResponse = completion.data.choices[0].message;
    console.log(completion.data);
    console.log("completionResponse: ", completionResponse)
    //console.log("content: ",completionResponse.content)

    // content is null bcos it is doing a function_call
    if (!completionResponse.content) {
      const functionCallName = completionResponse.function_call.name;
      console.log("functionCallName: ", functionCallName)

      if (functionCallName === "lookupTime") {
        // Need to parse the arguments with JSON.parse()
        const completionArguments = JSON.parse(completionResponse.function_call.arguments)
        console.log("Arguments & location: ", completionArguments, completionArguments.location)

        result = await lookupTime(completionArguments.location)

        return res.status(200).json({
          success: true,
          message: `${result},`,
        });
      }

      if (functionCallName === "lookupWeather") {
        // Need to parse the arguments with JSON.parse()
        const completionArguments = JSON.parse(completionResponse.function_call.arguments)
        console.log("Arguments & id: ", completionArguments, completionArguments.location_id)
        result = await lookupWeather(completionArguments.location_id)

        return res.status(200).json({
          success: true,
          message: `${result}`,
        });
      }

      if (functionCallName === "lookupBinancePrice") {
        // Need to parse the arguments with JSON.parse()
        const completionArguments = JSON.parse(completionResponse.function_call.arguments)
        console.log("coin pair: ", completionArguments, completionArguments.coinpair)
        result = await lookupBinancePrice(completionArguments.coinpair)

        return res.status(200).json({
          success: true,
          message: `${result} `,
        });
      }

      if (functionCallName === "BinanceLoanHistory") {
        // Need to parse the arguments with JSON.parse()
        const completionArguments = JSON.parse(completionResponse.function_call.arguments)
        console.log("coin: ", completionArguments, completionArguments.coin)
        result = await binanceLoanHistory(completionArguments.coin)

        return res.status(200).json({
          success: true,
          message: `${result} `,
        });
      }

      if (functionCallName === "getAirportCode") {
        // Need to parse the arguments with JSON.parse()
        const completionArguments = JSON.parse(completionResponse.function_call.arguments)
        console.log("iata: ", completionArguments, completionArguments.iata)
        result = await getAirportCode(completionArguments.iata)
        console.log(result.city)

        // Call other functions after first functions
        result2 = await getAirQuality(result.city)

        if ( result2 !== null ) {
        return res.status(200).json({
          success: true,
          message: `${result.name} ${result.iata} PM10: ${result2.PM10.concentration} PM2.5: ${result2.PM25.concentration}`,
        });
        }
      }

      if (functionCallName === "getCityData") {
        // Need to parse the arguments with JSON.parse()
        const completionArguments = JSON.parse(completionResponse.function_call.arguments)
        console.log("city: ", completionArguments, completionArguments.city)
        args = completionArguments

      runAllCityfunctions(args.wx_city, args.iata, args.tz, args.wx_id )
        .then((results) => {
          console.log('All functions completed:', results);

          return res.status(200).json({
            success: true,
            message: results
          });

        })
        .catch((error) => {
          console.error('Error in one of the functions:', error);
        });

      }

    } else {
      console.log("Not a function call, just return the content: ")
      return res.status(200).json({
        success: true,
        message: completionResponse.content,
      });

    }

  } catch (error) {
    console.log(error.message);
  }
});

app.listen(port, () => console.log(`Server is running on port ${port}!!`));

