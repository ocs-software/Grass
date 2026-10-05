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
                "Only state facts that are directly supported by the tool results. " +
                "Do not infer the player's intention, strategy, reason for a club choice, " +
                "type of shot, recovery action, or cause of an outcome unless the tool " +
                "result explicitly establishes it. " +
                "For example, do not label a shot as a re-shot, relief shot, approach, " +
                "chip, pitch, lay-up, or unusual club choice merely from the shot sequence. " +
                "Shot outcome data is authoritative when interpreting where a shot ended. " +
                "Player-rated shot quality is subjective user input from 1 to 5 and must " +
                "not be presented as an objective measurement. " +
                "Recorded club distance is ball travel distance and is not necessarily " +
                "carry distance or an indication that longer is better. " +
                "Respect the metric direction metadata when deciding whether a change " +
                "is better or worse. " +
                "Consider sample size, telemetry coverage and data-quality limitations. " +
                "Do not claim strokes-gained analysis because benchmark data is not " +
                "currently available. " +
                "Use the most specific tool that can answer the question. " +
                "If the user asks about a specific hole, use get_hole directly rather " +
                "than retrieving the entire round first unless round-level context is " +
                "actually required. " +
                "Keep answers concise and useful to the golfer."
        },
        {
            role: "user",
            content: question
        }
    ];

    const toolHistory = [];

    const maxToolRounds = 5;

    for (let toolRound = 0; toolRound < maxToolRounds; toolRound++) {
        const response = await openrouter.chat.completions.create({
            model: "google/gemma-4-31b-it:free",
            messages: messages,
            tools: OPENROUTER_TOOLS,
            tool_choice: "auto"
        });

        if (!response.choices || response.choices.length === 0) {
            throw new Error("OpenRouter returned no response choices.");
        }

        const message = response.choices[0].message;

        const toolCalls = Array.isArray(message.tool_calls)
            ? message.tool_calls
            : [];

        if (toolCalls.length === 0) {
            return {
                model: response.model,
                content: message.content || "",
                toolHistory: toolHistory
            };
        }

        messages.push({
            role: "assistant",
            content: message.content || null,
            tool_calls: toolCalls
        });

        for (const toolCall of toolCalls) {
            if (!toolCall.function || !toolCall.function.name) {
                throw new Error("OpenRouter returned an invalid tool call.");
            }

            const internalToolCall = {
                name: toolCall.function.name,
                arguments: toolCall.function.arguments || "{}"
            };

            const toolResult = await executeGolfAITool(
                internalToolCall,
                serverContext
            );

            toolHistory.push({
                name: internalToolCall.name,
                arguments: JSON.parse(internalToolCall.arguments),
                result: toolResult
            });

            messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: JSON.stringify(toolResult)
            });
        }
    }

    throw new Error("Golf AI exceeded the maximum number of tool rounds.");
}

module.exports = {
    askGolfAI
};
