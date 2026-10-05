const OpenAI = require("openai");

const { GOLF_AI_TOOLS, executeGolfAITool } = require("./golfAIOpenAITools");

const openrouter = new OpenAI({
    apiKey: process.env.OPENROUTER_API_KEY,
    baseURL: "https://openrouter.ai/api/v1"
});

const OPENROUTER_TOOLS = GOLF_AI_TOOLS.map(function (tool) {
    return {
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
            strict: tool.strict
        }
    };
});

async function askGolfAI(question, serverContext) {
    if (!process.env.OPENROUTER_API_KEY) {
        throw new Error("OPENROUTER_API_KEY is not configured.");
    }

    if (!question || typeof question !== "string") {
        throw new Error("Golf AI question is required.");
    }

    const messages = [
        {
            role: "system",
            content:
                "You are a golf performance analyst. " +
                "Use the supplied tools when golf performance data is needed. " +
                "The application's calculated statistics are authoritative. " +
                "Do not invent statistics or recalculate them from assumptions. " +
                "Respect the metric direction metadata when deciding whether " +
                "a change is better or worse. " +
                "Player-rated shot quality is subjective. " +
                "Recorded club distance is ball travel distance and is not " +
                "necessarily carry distance or an indication that longer is better. " +
                "Consider sample size and data-quality limitations. " +
                "Do not claim strokes-gained analysis because benchmark data " +
                "is not currently available."
        },
        {
            role: "user",
            content: question
        }
    ];

    const response = await openrouter.chat.completions.create({
        model: "openrouter/free",
        messages: messages,
        tools: OPENROUTER_TOOLS,
        tool_choice: "auto"
    });

    const message = response.choices[0].message;

    return {
        model: response.model,
        content: message.content || null,
        toolCalls: message.tool_calls || []
    };
}

module.exports = {
    askGolfAI
};
