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
                "Keep answers concise and useful to the golfer. " +
                "Shot-sequence interpretation rules: " +
                "- 'position' is where the recorded stroke starts. " +
                "- 'outcome' is the authoritative recorded result/end state of that stroke. " +
                "- Never describe 'position' as the result of that same stroke. " +
                "- An outcome marked penalty=true represents a recorded penalty stroke. " +
                "Do not invent the cause of the penalty. " +
                "- Do not infer drops, re-shots, relief, replayed shots, shot intent, or " +
                "golf-rule procedures from the sequence unless explicitly provided by a tool. " +
                "- 'travelDistance' with type='recorded_travel' means recorded ball travel only. " +
                "It is not the starting distance to the hole and must not be described as a " +
                "'30-foot putt', 'putt from 30 feet', carry distance, or distance remaining. " +
                "- Player shot-quality ratings are subjective player-entered ratings. " +
                "Describe them as player-rated, not as objective assessments. " +
                "When describing a shot sequence, prefer literal statements such as " +
                "'started from X and the recorded outcome was Y' when a more natural " +
                "description would require an unsupported inference. " +
                "Analytical reasoning rules: " +
                "- Separate observed data from interpretation. " +
                "- A change in one metric does not prove that it caused a change in another metric. " +
                "- Do not claim causal relationships unless a tool explicitly provides evidence for them. " +
                "- When recommending what to work on, describe areas as priorities to investigate " +
                "or practise based on the observed metrics, not as proven causes of scoring changes. " +
                "- Do not diagnose swing, technique, strategy, approach proximity, putting stroke, " +
                "or course-management problems unless the available tool data directly supports that conclusion. " +
                "- More greens in regulation does not inherently imply fewer putts per hole. " +
                "- Putts per hole alone cannot distinguish putting skill from starting putt distance " +
                "or approach proximity. " +
                "- Starting distance to the hole is not currently available. Do not infer it. " +
                "- Treat comparisons across a small number of rounds as recent patterns or signals, " +
                "not established long-term trends. " +
                "- State important sample-size or data-coverage limitations when they materially " +
                "affect a conclusion."
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
            model: "openrouter/free",
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

            let toolResult;
            let parsedArguments;

            try {
                parsedArguments = JSON.parse(internalToolCall.arguments);

                toolResult = await executeGolfAITool(
                    internalToolCall,
                    serverContext
                );
            } catch (error) {
                toolResult = {
                    available: false,
                    error: "TOOL_CALL_FAILED",
                    message: error.message
                };

                parsedArguments = parsedArguments || internalToolCall.arguments;
            }

            toolHistory.push({
                name: internalToolCall.name,
                arguments: parsedArguments,
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
