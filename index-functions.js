require("dotenv").config();
const axios = require('axios');
//const rateLimit = require('axios-rate-limit');
//const rateLimitedAxios = rateLimit(axios.create(), { maxRequests: 5, perMilliseconds: 1000 }); 

const { Spot } = require('@binance/connector')
const bin_apiKey = process.env.BINANCE_API_KEY 
const bin_apiSecret = process.env.BINANCE_API_SECRET

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



async function lookupTime(location) {
  const response = await axios.get(`http://worldtimeapi.org/api/timezone/${location}`);
  //console.log(response.data)
  const { datetime } = response.data;
  const localTime = new Date(datetime).toLocaleTimeString(undefined,
    { hour: 'numeric', minute: 'numeric', hour12: true });
  console.log(`Current time in ${location} in ${localTime}`)

  return `current time in ${location} in ${localTime}`;
}

async function lookupWeather(location_id) {
  const response = await
    axios.get(`https://api.openweathermap.org/data/2.5/weather?units=metric&appid=${process.env.OPENWX_API_KEY}&id=${location_id}`);

  //console.log(response.data.weather[0].description)

  const forecast = response.data.weather[0].description
  const name = response.data.name
  const weather_code = response.data.weather[0].id
  const temp = response.data.main.temp
  const temp_min = response.data.main.temp_min
  const temp_max = response.data.main.temp_max
  console.log(weather_code, forecast, temp, temp_min, temp_max)

  return `curent weather in ${name} is ${forecast} with temperature of ${temp}`
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

    } else {
      console.log("Not a function call, just return the content: " )
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

