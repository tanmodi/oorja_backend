/**
 * PDF processing service
 */
const fs = require('fs-extra');
const pdfParse = require('pdf-parse');
const { OpenAI } = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// List of available models
const AVAILABLE_MODELS = ['gpt-4.5-preview', 'gpt-4o', 'gpt-4o-mini', 'o3-mini', 'o1', 'o1-pro'];
// const AVAILABLE_MODELS = ['gpt-4o'];


/**
 * Calculate price based on token usage and model
 * @param {string} model - The GPT model being used
 * @param {Object} usage - Token usage information
 * @returns {Object} Price calculations
 */
const calculatePrice = (model, usage) => {
  if (!usage || typeof usage !== 'object') {
    console.error('Invalid usage object:', usage);
    return {
      model,
      rates: {
        inputRate: 'N/A',
        cachedInputRate: 'N/A',
        outputRate: 'N/A'
      },
      costs: {
        inputCost: 'N/A',
        outputCost: 'N/A',
        totalCost: 'N/A'
      }
    };
  }

  // Extract token counts from usage object, handling both API response formats
  const promptTokens = usage.prompt_tokens || usage.input_tokens || 0;
  const completionTokens = usage.completion_tokens || usage.output_tokens || 0;
  const totalTokens = usage.total_tokens || (promptTokens + completionTokens);

  const prices = {
    'gpt-4.5-preview': {
      input: 75.0,
      cachedInput: 37.5,
      output: 150.0
    },
    'gpt-4o': {
      input: 2.5,
      cachedInput: 1.25,
      output: 10.0
    },
    'gpt-4o-mini': {
      input: 0.15,
      cachedInput: 0.075,
      output: 0.60
    },
    'o3-mini': {
      input: 1.10,
      cachedInput: 0.55,
      output: 4.40
    },
    'o1': {
      input: 15.00,
      cachedInput: 7.50,
      output: 60.00
    },
    'o1-pro': {
      input: 150.00,
      cachedInput: 150.00, // For o1-pro, there's no separate cached input price mentioned
      output: 600.00
    }
  };

  const modelPrices = prices[model] || prices['gpt-4o']; // Default to gpt-4o if model not found

  // Calculate prices per million tokens
  const inputPrice = (promptTokens / 1000000) * modelPrices.input;
  const outputPrice = (completionTokens / 1000000) * modelPrices.output;

  return {
    model,
    rates: {
      inputRate: `$${modelPrices.input.toFixed(2)} per million tokens`,
      cachedInputRate: `$${modelPrices.cachedInput.toFixed(2)} per million tokens`,
      outputRate: `$${modelPrices.output.toFixed(2)} per million tokens`
    },
    costs: {
      inputCost: `$${inputPrice.toFixed(6)}`,
      outputCost: `$${outputPrice.toFixed(6)}`,
      totalCost: `$${(inputPrice + outputPrice).toFixed(6)}`
    }
  };
};

/**
 * Extract bill data from PDF using OpenAI
 * @param {Object} fileData - File data from multer
 * @param {string} [model='o3-mini'] - The model to use for extraction
 * @returns {Promise<Object>} Extracted data and token usage
 * @throws {Error} If data extraction fails
 */
exports.extractBillData = async (fileData, model = 'o3-mini') => {
  try {
    // Make a copy of the file to use for extraction
    const tempFilePath = fileData.path;
    
    // Read the PDF file content locally
    const pdfBuffer = await fs.readFile(tempFilePath);

    // Extract text from the PDF using pdf-parse
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    let response;
    let content;
    let usage;

    try {
      // Use responses.create API for all models
      response = await openai.responses.create({
        model: model,
        input: [
          {
            role: "system",
            content: "You are a helpful assistant that extracts information from electricity bills. You must return your response as a valid JSON object without any markdown formatting or code blocks."
          },
          {
            role: "user",
            content: `Extract the following fields from this electricity bill text and return ONLY a JSON object (no markdown, no \`\`\` blocks):\n\nRequired fields: Address, Arrears, BaCode, BillDate, BillDueDate, BilledUnit, BillFetchTimeStamp, BillMonth, BillNo, CanSerNo, CGST, CircleCode, CmrDt, CmrKwh, ConCat, ConnLd, ConnType, ConsumerName, ConsUnits, CurAmtPay, DiscCode, EleDuty, EngyChg, EntityCode, EntityType, Filename, FinalClosingReading, FinalConsUnits, FinalOpeningReading, FulCstAdj, FxdChg, GrosAmt, LastAmountpaid, LastAmountPaidDate, LtPaySurChg, MeterStatus, MetRent, MetrNo, MulFac, OmrDt, OmrKwh.\n\nBill text:\n${extractedText}`
          }
        ],
        temperature: model.startsWith('gpt-') ? 0.1 : undefined
      });
      
      // Extract content from response
      content = response.output_text;
      usage = response.usage;
    } catch (error) {
      console.error(`Error with responses API for model ${model}:`, error);
      throw new Error(`Failed to process with model ${model}: ${error.message}`);
    }

    // Try to parse the JSON from the response
    let extractedData;
    try {
      // First try direct JSON parsing
      extractedData = JSON.parse(content);
    } catch (firstError) {
      try {
        // If that fails, try to extract JSON from markdown code blocks
        const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                         content.match(/\{[\s\S]*\}/);
        
        if (!jsonMatch) {
          throw new Error('No valid JSON found in response');
        }

        const jsonString = jsonMatch[1] || jsonMatch[0];
        extractedData = JSON.parse(jsonString);
      } catch (secondError) {
        console.error("Failed to parse JSON from response:", content);
        throw new Error('Failed to parse bill data from OpenAI response');
      }
    }

    // Validate the extracted data
    if (!extractedData || typeof extractedData !== 'object') {
      throw new Error('Invalid data format received from OpenAI');
    }

    // Clean up the temporary file
    await fs.remove(fileData.path);

    // Calculate pricing
    const pricing = calculatePrice(model, usage);

    // Return data, usage, and pricing information
    return {
      data: extractedData,
      usage: {
        prompt_tokens: usage.prompt_tokens || usage.input_tokens || 0,
        completion_tokens: usage.completion_tokens || usage.output_tokens || 0,
        total_tokens: usage.total_tokens || (
          (usage.prompt_tokens || usage.input_tokens || 0) + 
          (usage.completion_tokens || usage.output_tokens || 0)
        )
      },
      pricing
    };
  } catch (error) {
    console.error(`Error extracting bill data with model ${model}:`, error);
    throw error;
  }
};

/**
 * Extract bill data from PDF using all available models
 * @param {Object} fileData - File data from multer
 * @returns {Promise<Array<Object>>} Array of results from all models
 */
exports.extractBillDataWithAllModels = async (fileData) => {
  try {
    // Create a temporary copy of the file for processing
    const tempFilePath = fileData.path;
    const pdfBuffer = await fs.readFile(tempFilePath);
    
    // Extract text from the PDF only once to avoid multiple parsing
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;
    
    // Process with each model sequentially
    const results = [];
    
    for (const model of AVAILABLE_MODELS) {
      try {
        console.log(`Processing with model: ${model}`);
        
        // Record start time
        const startTime = new Date();
        const startTimeFormatted = startTime.toISOString();
        
        let response;
        let content;
        let usage;

        try {
          // Use responses.create API for all models
          response = await openai.responses.create({
            model: model,
            input: [
              {
                role: "system",
                content: "You are a helpful assistant that extracts information from electricity bills. You must return your response as a valid JSON object without any markdown formatting or code blocks."
              },
              {
                role: "user",
                content: `Extract the following fields from this electricity bill text and return ONLY a JSON object (no markdown, no \`\`\` blocks):\n\nRequired fields: Address, Arrears, BaCode, BillDate, BillDueDate, BilledUnit, BillFetchTimeStamp, BillMonth, BillNo, CanSerNo, CGST, CircleCode, CmrDt, CmrKwh, ConCat, ConnLd, ConnType, ConsumerName, ConsUnits, CurAmtPay, DiscCode, EleDuty, EngyChg, EntityCode, EntityType, Filename, FinalClosingReading, FinalConsUnits, FinalOpeningReading, FulCstAdj, FxdChg, GrosAmt, LastAmountpaid, LastAmountPaidDate, LtPaySurChg, MeterStatus, MetRent, MetrNo, MulFac, OmrDt, OmrKwh.\n\nBill text:\n${extractedText}`
              }
            ],
            temperature: model.startsWith('gpt-') ? 0.1 : undefined
          });

          console.log(`Response received for model ${model}`);
          console.log(`Response: ${JSON.stringify(response)}`);
          console.log(response);

          
          // Extract content from response
          content = response.output_text;
          usage = response.usage;
        } catch (error) {
          console.error(`Error with responses API for model ${model}:`, error);
          throw new Error(`Failed to process with model ${model}: ${error.message}`);
        }

        // Record end time
        const endTime = new Date();
        const endTimeFormatted = endTime.toISOString();
        
        // Calculate duration in milliseconds and seconds
        const durationMs = endTime - startTime;
        const durationSec = (durationMs / 1000).toFixed(2);

        // Try to parse the JSON from the response
        let extractedData;
        try {
          // First try direct JSON parsing
          extractedData = JSON.parse(content);
        } catch (firstError) {
          try {
            // If that fails, try to extract JSON from markdown code blocks
            const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || 
                            content.match(/\{[\s\S]*\}/);
            
            if (!jsonMatch) {
              throw new Error('No valid JSON found in response');
            }

            const jsonString = jsonMatch[1] || jsonMatch[0];
            extractedData = JSON.parse(jsonString);
          } catch (secondError) {
            console.error(`Failed to parse JSON from ${model} response:`, content);
            throw new Error(`Failed to parse bill data from ${model} response`);
          }
        }
        
        // Calculate pricing
        const pricing = calculatePrice(model, usage);
        
        // Add result to array with timing information
        results.push({
          model,
          data: extractedData,
          usage: {
            prompt_tokens: usage.prompt_tokens || usage.input_tokens || 0,
            completion_tokens: usage.completion_tokens || usage.output_tokens || 0,
            total_tokens: usage.total_tokens || (
              (usage.prompt_tokens || usage.input_tokens || 0) + 
              (usage.completion_tokens || usage.output_tokens || 0)
            )
          },
          pricing,
          timing: {
            startTime: startTimeFormatted,
            endTime: endTimeFormatted,
            durationMs,
            durationSec: `${durationSec} seconds`
          },
          processingTime: usage.total_ms || 0
        });
        
      } catch (modelError) {
        // If one model fails, add error information but continue with others
        results.push({
          model,
          error: modelError.message,
          data: null,
          usage: null,
          pricing: null,
          timing: {
            startTime: new Date().toISOString(),
            endTime: new Date().toISOString(),
            durationMs: 0,
            durationSec: "0.00 seconds"
          }
        });
      }
    }
    
    // Clean up the original file after all processing is complete
    await fs.remove(fileData.path);
    
    return results;
  } catch (error) {
    console.error("Error processing with all models:", error);
    
    // Clean up the file in case of error
    if (fileData.path) {
      await fs.remove(fileData.path).catch(() => {});
    }
    
    throw error;
  }
};