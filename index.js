require("dotenv").config();
const axios = require('axios');
const rateLimit = require('axios-rate-limit');

const rateLimitedAxios = rateLimit(axios.create(), { maxRequests: 5, perMilliseconds: 1000 }); // Adjust the values based on the rate limits specified by OpenAI

const express = require("express");
const app = express();
app.use(express.json());

const port = process.env.PORT || 5050;

async function lookupTime(location) {
  const response = await axios.get(`http://worldtimeapi.org/api/timezone/${location}`);

  const { datetime } = response.data;

  const localTime = new Date(datetime).toLocaleTimeString(undefined, { house: 'numeric', minute: 'numeric', hour12: true});

  console.log(`Current time in ${location} in ${localTime}` )

}


app.post("/ask", async (req, res) => {
  const prompt = req.body.prompt;
  try {
    if (prompt == null) {
      throw new Error("Uh oh, no prompt was provided");
    }

    const response = await rateLimitedAxios.post('https://api.openai.com/v1/engines/text-davinci-003/completions', {
      prompt: prompt,
      max_tokens: 100,
      temperature: 0.1,
      n: 1
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      }
    });

    const completion = response.data.choices[0].text;
    return res.status(200).json({
      success: true,
      message: completion,
    });
  } catch (error) {
    console.log(error.message);
  }
});

app.listen(port, () => console.log(`Server is running on port ${port}!!`));

