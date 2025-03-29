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

/**
 * Extract bill data from PDF using OpenAI
 * @param {Object} fileData - File data from multer
 * @returns {Promise<Object>} Extracted data and token usage
 * @throws {Error} If data extraction fails
 */
exports.extractBillData = async (fileData) => {
  try {
    // Read the PDF file content locally
    const pdfBuffer = await fs.readFile(fileData.path);

    // Extract text from the PDF using pdf-parse
    const pdfData = await pdfParse(pdfBuffer);
    const extractedText = pdfData.text;

    // Create a chat completion with the extracted text
    const response = await openai.chat.completions.create({
      model: "gpt-4.5-preview",
      messages: [
        {
          role: "system",
          content: "You are a helpful assistant that extracts information from electricity bills. You must return your response as a valid JSON object without any markdown formatting or code blocks."
        },
        {
          role: "user",
          content: `Extract the following fields from this electricity bill text and return ONLY a JSON object (no markdown, no \`\`\` blocks):\n\nRequired fields: Address, Arrears, BaCode, BillDate, BillDueDate, BilledUnit, BillFetchTimeStamp, BillMonth, BillNo, CanSerNo, CGST, CircleCode, CmrDt, CmrKwh, ConCat, ConnLd, ConnType, ConsumerName, ConsUnits, CurAmtPay, DiscCode, EleDuty, EngyChg, EntityCode, EntityType, Filename, FinalClosingReading, FinalConsUnits, FinalOpeningReading, FulCstAdj, FxdChg, GrosAmt, LastAmountpaid, LastAmountPaidDate, LtPaySurChg, MeterStatus, MetRent, MetrNo, MulFac, OmrDt, OmrKwh.\n\nBill text:\n${extractedText}`
        }
      ],
      max_tokens: 4000,
      temperature: 0.1 // Lower temperature for more consistent JSON formatting
    });

    console.log("OpenAI response:", response);

    // Extract the response content
    const content = response.choices[0].message.content;

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

    // Return both the extracted data and token usage
    return {
      data: extractedData,
      usage: {
        prompt_tokens: response.usage.prompt_tokens,
        completion_tokens: response.usage.completion_tokens,
        total_tokens: response.usage.total_tokens
      }
    };
  } catch (error) {
    console.error("Error extracting bill data:", error);

    // Clean up the temporary file in case of error
    if (fileData.path) {
      await fs.remove(fileData.path).catch(() => {});
    }

    throw error;
  }
};