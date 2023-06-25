require("dotenv").config();
const axios = require('axios');
//const rateLimit = require('axios-rate-limit');
//const rateLimitedAxios = rateLimit(axios.create(), { maxRequests: 5, perMilliseconds: 1000 }); 

const express = require("express");
const app = express();
app.use(express.json());

const { Configuration, OpenAIApi, chatCompletion } = require("openai");
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

//const endpoint = "https://api.openai.com/v1/engines/text-davinci-003/completions"



// const params = {
//   prompt: prompt,
//   max_tokens: 100,
//   temperature: 0.1,
//   functions
// }

// only needed for Axios
// const headers = {
//   headers: {
//     'Content-Type': 'application/json',
//     'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
//   }
// }

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
  const name =  response.data.name
  const weather_code = response.data.weather[0].id
  const temp = response.data.main.temp
  const temp_min = response.data.main.temp_min
  const temp_max = response.data.main.temp_max
  console.log(weather_code, forecast, temp, temp_min, temp_max)

  return `curent weather in ${name} is ${forecast} with temperature of ${temp}`
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

        result1 = await lookupTime(completionArguments.location)
      }

      if (functionCallName === "lookupWeather") {
        // Need to parse the arguments with JSON.parse()
        const completionArguments = JSON.parse(completionResponse.function_call.arguments)
        console.log("Arguments & id: ", completionArguments, completionArguments.location_id)
        result2 = await lookupWeather(completionArguments.location_id)
      }

      return res.status(200).json({
        success: true,
        message: `${result1}, ${result2}\n`,
      });

    }

  } catch (error) {
    console.log(error.message);
  }
});

app.listen(port, () => console.log(`Server is running on port ${port}!!`));

