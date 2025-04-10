const axios = require('axios');
const colors = require('colors');

const API_URL = 'http://localhost:3000';
const TEST_TICKET_ID = process.env.TEST_TICKET_ID || 'e00be12d-6581-4f11-8071-0d80d57a44cc';

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
    
    logInfo('Simulating two clients with the same initial version information');
    
    logInfo('First client attempting update...');
    const update1 = await updateTicket(TEST_TICKET_ID, {
      title: `Updated by Client 1 at ${new Date().toISOString()}`,
      version: staleVersion
    });
    
    logInfo('Second client attempting update with now-stale version...');
    try {
      const update2 = await updateTicket(TEST_TICKET_ID, {
        title: `Updated by Client 2 at ${new Date().toISOString()}`,
        version: staleVersion
      });
      
      logWarning('Update succeeded, which means:');
      logWarning('1. The server is accepting the version field but not checking it for consistency');
      logWarning('2. This can lead to the "lost update" problem in concurrent environments');
      logWarning('3. A proper implementation should throw 409 Conflict for stale versions');
    } catch (error) {
      if (error.response?.status === 409) {
        logSuccess('Successfully demonstrated version conflict!');
        logInfo(`Client 2 had version ${staleVersion} but server expected version ${update1.version}`);
      } else {
        throw error;
      }
    }
    
    const finalTicket = await getTicket(TEST_TICKET_ID);
    logInfo(`Final ticket: ID=${finalTicket.id}, Title="${finalTicket.title}", Version=${finalTicket.version}`);
    
    logInfo('');
    logInfo('Note: The standard update endpoint does not perform version checking.');
    logInfo('For proper optimistic locking, you should use:');
    logInfo('1. The /tickets/:id/with-retry endpoint for service-side handling');
    logInfo('2. Client-side retry logic with explicit version checking');
  } catch (error) {
    logError(`Demonstration failed: ${error.message}`);
  }
}

async function demonstrateClientRetryMechanism() {
  logHeader('Demonstrating Client-Side Retry Mechanism');
  
  try {
    const ticket = await getTicket(TEST_TICKET_ID);
    logInfo(`Original ticket: ID=${ticket.id}, Title="${ticket.title}", Version=${ticket.version}`);
    
    const originalVersion = ticket.version;
    
    logInfo('Making an initial change to increase the version number...');
    const updatedTicket = await updateTicket(TEST_TICKET_ID, {
      title: `Ticket updated by background process at ${new Date().toISOString()}`,
      version: originalVersion
    });
    
    logInfo('Starting client-side retry demonstration with now-stale version...');
    logInfo(`Current server version: ${updatedTicket.version}, but client still has: ${originalVersion}`);
    
    logInfo(`Calling updateTicketWithRetry with stale version ${originalVersion}...`);
    const retryResult = await updateTicketWithRetry(TEST_TICKET_ID, {
      title: `Client retry update at ${new Date().toISOString()}`,
      version: originalVersion
    });
    
    logSuccess(`Client retry successful! New version: ${retryResult.version}`);
    logInfo(`The update operation automatically fetched latest version and retried`);
  } catch (error) {
    logError(`Client retry demonstration failed: ${error.message}`);
  }
}

async function demonstrateServiceRetry() {
  logHeader('Demonstrating Service-Level Retry');
  
  try {
    const ticket = await getTicket(TEST_TICKET_ID);
    logInfo(`Original ticket: ID=${ticket.id}, Title="${ticket.title}", Version=${ticket.version}`);
    
    logInfo(`Using service-level retry endpoint without specifying version...`);
    logInfo(`The server will automatically retry on version conflicts`);
    
    const response = await axios.patch(`${API_URL}/tickets/${TEST_TICKET_ID}/with-retry`, {
      title: `Service retry update at ${new Date().toISOString()}`
    });
    
    logSuccess(`Service retry successful! New version: ${response.data.version}`);
    logInfo(`The server handled the optimistic concurrency internally`);
    
    const finalTicket = await getTicket(TEST_TICKET_ID);
    logInfo(`Final ticket: ID=${finalTicket.id}, Title="${finalTicket.title}", Version=${finalTicket.version}`);
    
    logHeader('Key Differences');
    logInfo(`Client-side retry: Client code handles fetching new versions and retrying`);
    logInfo(`Service-level retry: Server handles all retry logic transparently`);
    logInfo(`Both approaches prevent lost updates in concurrent environments`);
  } catch (error) {
    logError(`Service retry demonstration failed: ${error.response?.data?.message || error.message}`);
  }
}

async function compareBookingStrategies() {
  logHeader('Comparing Optimistic vs Pessimistic Locking for Booking');
  
  try {
    const ticket = await getTicket(TEST_TICKET_ID);
    logInfo(`Original ticket: ID=${ticket.id}, Quantity=${ticket.quantity}, Version=${ticket.version}`);
    
    if (ticket.quantity < 10) {
      logInfo('Resetting ticket quantity to 10 for demonstration...');
      await updateTicket(TEST_TICKET_ID, {
        quantity: 10,
        version: ticket.version
      });
      
      const resetTicket = await getTicket(TEST_TICKET_ID);
      logInfo(`Reset ticket: ID=${resetTicket.id}, Quantity=${resetTicket.quantity}, Version=${resetTicket.version}`);
    }
    
    logInfo('\nDemonstrating pessimistic locking (FOR UPDATE):');
    const startTimePessimistic = Date.now();
    try {
      const response = await axios.post(`${API_URL}/tickets/${TEST_TICKET_ID}/book`, {
        quantity: 1,
        userId: 'test-user-id'
      });
      const endTimePessimistic = Date.now();
      logSuccess(`Pessimistic booking successful! New quantity: ${response.data.quantity}`);
      logInfo(`Time taken: ${endTimePessimistic - startTimePessimistic}ms`);
    } catch (error) {
      logError(`Pessimistic booking failed: ${error.response?.data?.message || error.message}`);
    }
    
    logInfo('\nDemonstrating optimistic concurrency:');
    const startTimeOptimistic = Date.now();
    try {
      const response = await axios.post(`${API_URL}/tickets/${TEST_TICKET_ID}/book-optimistic`, {
        quantity: 1,
        userId: 'test-user-id'
      });
      const endTimeOptimistic = Date.now();
      logSuccess(`Optimistic booking successful! New quantity: ${response.data.quantity}, Version: ${response.data.version}`);
      logInfo(`Time taken: ${endTimeOptimistic - startTimeOptimistic}ms`);
    } catch (error) {
      logError(`Optimistic booking failed: ${error.response?.data?.message || error.message}`);
    }
    
    const finalTicket = await getTicket(TEST_TICKET_ID);
    logInfo(`\nFinal ticket state: Quantity=${finalTicket.quantity}, Version=${finalTicket.version}`);
    
    logHeader('Strategy Comparison');
    logInfo('Pessimistic Locking:');
    logInfo('- Uses database locks (SELECT FOR UPDATE)');
    logInfo('- Prevents conflicts by blocking concurrent access');
    logInfo('- Good for high-contention scenarios but may reduce concurrency');
    logInfo('- Can lead to deadlocks if not designed properly');
    
    logInfo('\nOptimistic Concurrency:');
    logInfo('- Uses version tracking instead of locks');
    logInfo('- Allows concurrent access and checks for conflicts at commit time');
    logInfo('- Better concurrency but may require retries on conflict');
    logInfo('- Avoids deadlocks but may have higher overhead with many conflicts');
    
    logInfo('\nChoice depends on your specific use case:');
    logInfo('- High contention, short transactions: Pessimistic may be better');
    logInfo('- Low contention, long-running operations: Optimistic is usually better');
  } catch (error) {
    logError(`Booking comparison failed: ${error.message}`);
  }
}

async function main() {
  logHeader('Optimistic Concurrency Control Demonstration');
  
  try {
    await axios.get(`${API_URL}/tickets`);
    logSuccess('Connected to API successfully');
    
    if (TEST_TICKET_ID === 'your-ticket-id-here') {
      logError('Please update the TEST_TICKET_ID in the script or provide it as an environment variable');
      return;
    }
    
    try {
      await getTicket(TEST_TICKET_ID);
    } catch (error) {
      logError(`Test ticket not found. Please create a ticket and set its ID in TEST_TICKET_ID`);
      logInfo('You can create a ticket with: curl -X POST http://localhost:3000/tickets -H "Content-Type: application/json" -d \'{"title": "Test Ticket", "description": "For optimistic concurrency test", "price": 100, "quantity": 10, "userId": "123e4567-e89b-12d3-a456-426614174000"}\'');
      return;
    }
    
    await demonstrateVersionConflict();
    await demonstrateClientRetryMechanism();
    await demonstrateServiceRetry();
    await compareBookingStrategies();
    
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