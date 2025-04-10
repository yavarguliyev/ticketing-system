const axios = require('axios');
const colors = require('colors');

const API_URL = 'http://localhost:3000';
const TEST_TICKET_ID = process.env.TEST_TICKET_ID || 'your-ticket-id-here';

const logInfo = (message) => console.log(colors.blue(`[INFO] ${message}`));
const logSuccess = (message) => console.log(colors.green(`[SUCCESS] ${message}`));
const logError = (message) => console.log(colors.red(`[ERROR] ${message}`));
const logWarning = (message) => console.log(colors.yellow(`[WARNING] ${message}`));
const logHeader = (message) => console.log(colors.cyan.bold(`\n=== ${message} ===`));

async function getTicket(ticketId) {
  logInfo(`Fetching ticket ${ticketId}...`);
  const response = await axios.get(`${API_URL}/tickets/${ticketId}`);
  return response.data;
}

async function updateTicket(ticketId, updateData) {
  logInfo(`Updating ticket ${ticketId} with version ${updateData.version || 'N/A'}...`);
  try {
    const response = await axios.patch(`${API_URL}/tickets/${ticketId}`, updateData);
    logSuccess(`Update successful! New version: ${response.data.version}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 409) {
      logError(`Version conflict! Expected version: ${updateData.version}, actual version: ${error.response.data.actualVersion}`);
    } else {
      logError(`Error updating ticket: ${error.response?.data?.message || error.message}`);
    }
    throw error;
  }
}

async function updateTicketWithRetry(ticketId, updateData, maxRetries = 3) {
  let retries = 0;
  
  while (retries <= maxRetries) {
    try {
      if (retries > 0) {
        const latestTicket = await getTicket(ticketId);
        updateData.version = latestTicket.version;
        logInfo(`Retry ${retries}/${maxRetries}: Using updated version ${updateData.version}`);
      }
      
      return await updateTicket(ticketId, updateData);
    } catch (error) {
      if (error.response?.status === 409 && retries < maxRetries) {
        retries++;
        const delay = 500 * retries;
        logWarning(`Retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      } else {
        logError(`Failed after ${retries} retries`);
        throw error;
      }
    }
  }
}

async function demonstrateVersionConflict() {
  logHeader('Demonstrating Version Conflict');
  
  try {
    const ticket = await getTicket(TEST_TICKET_ID);
    logInfo(`Original ticket: ID=${ticket.id}, Title="${ticket.title}", Version=${ticket.version}`);
    
    const staleVersion = ticket.version;
    
    const update1 = await updateTicket(TEST_TICKET_ID, {
      title: `Updated title at ${new Date().toISOString()}`,
      version: staleVersion
    });
    
    try {
      await updateTicket(TEST_TICKET_ID, {
        title: `This update should fail - ${new Date().toISOString()}`,
        version: staleVersion
      });
    } catch (error) {
      logSuccess('Successfully demonstrated version conflict!');
    }
  } catch (error) {
    logError(`Demonstration failed: ${error.message}`);
  }
}

async function demonstrateClientRetryMechanism() {
  logHeader('Demonstrating Client-Side Retry Mechanism');
  
  try {
    const ticket = await getTicket(TEST_TICKET_ID);
    logInfo(`Original ticket: ID=${ticket.id}, Title="${ticket.title}", Version=${ticket.version}`);
    
    const updatedTicket = await updateTicketWithRetry(TEST_TICKET_ID, {
      title: `Client retry update at ${new Date().toISOString()}`,
      version: ticket.version
    });
    
    logSuccess(`Client retry successful! New version: ${updatedTicket.version}`);
  } catch (error) {
    logError(`Client retry demonstration failed: ${error.message}`);
  }
}

async function demonstrateServiceRetry() {
  logHeader('Demonstrating Service-Level Retry');
  
  try {
    const ticket = await getTicket(TEST_TICKET_ID);
    logInfo(`Original ticket: ID=${ticket.id}, Title="${ticket.title}", Version=${ticket.version}`);
    
    logInfo('Using service-level retry endpoint...');
    const response = await axios.patch(`${API_URL}/tickets/${TEST_TICKET_ID}/with-retry`, {
      title: `Service retry update at ${new Date().toISOString()}`
    });
    
    logSuccess(`Service retry successful! New version: ${response.data.version}`);
  } catch (error) {
    logError(`Service retry demonstration failed: ${error.response?.data?.message || error.message}`);
  }
}

async function main() {
  logHeader('Optimistic Concurrency Control Demonstration');
  
  try {
    await axios.get(`${API_URL}/`);
    logSuccess('Connected to API successfully');
    
    if (TEST_TICKET_ID === 'your-ticket-id-here') {
      logError('Please update the TEST_TICKET_ID in the script or provide it as an environment variable');
      return;
    }
    
    try {
      await getTicket(TEST_TICKET_ID);
    } catch (error) {
      logError(`Test ticket not found. Please create a ticket and set its ID in TEST_TICKET_ID`);
      logInfo('You can create a ticket with: curl -X POST http://localhost:3000/tickets -H "Content-Type: application/json" -d \'{"title": "Test Ticket", "description": "For optimistic concurrency test", "price": 100, "quantity": 10}\'');
      return;
    }
    
    await demonstrateVersionConflict();
    await demonstrateClientRetryMechanism();
    await demonstrateServiceRetry();
    
    logHeader('Demonstration Complete');
  } catch (error) {
    logError(`Failed to connect to API: ${error.message}`);
    logInfo('Make sure the application is running on http://localhost:3000');
  }
}

main().catch(error => {
  logError(`Unhandled error: ${error.message}`);
  process.exit(1);
}); 