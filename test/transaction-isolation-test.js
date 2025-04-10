const axios = require('axios');
const colors = require('colors');

const API_URL = 'http://localhost:3000';
const TEST_TICKET_ID = process.env.TEST_TICKET_ID || 'your-ticket-id-here';

const logInfo = (message) => console.log(colors.blue(`[INFO] ${message}`));
const logSuccess = (message) => console.log(colors.green(`[SUCCESS] ${message}`));
const logError = (message) => console.log(colors.red(`[ERROR] ${message}`));
const logHeader = (message) => console.log(colors.cyan.bold(`\n=== ${message} ===`));

async function getTicket(ticketId) {
  logInfo(`Fetching ticket ${ticketId}...`);
  const response = await axios.get(`${API_URL}/tickets/${ticketId}`);
  return response.data;
}

async function bookTicket(ticketId, quantity, isolationLevel) {
  const endpoint = isolationLevel 
    ? `${API_URL}/tickets/${ticketId}/book-${isolationLevel.toLowerCase()}`
    : `${API_URL}/tickets/${ticketId}/book`;
  
  logInfo(`Booking ${quantity} tickets using ${isolationLevel || 'default'} isolation level...`);
  
  try {
    const response = await axios.post(endpoint, { quantity });
    logSuccess(`Booking successful! New quantity: ${response.data.quantity}`);
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    if (status === 409) {
      logError(`Booking failed: Not enough tickets available`);
    } else if (status === 423) {
      logError(`Booking failed: Resource is locked by another transaction`);
    } else {
      logError(`Booking failed: ${message}`);
    }
    
    throw error;
  }
}

async function releaseTicket(ticketId, quantity, isolationLevel) {
  const endpoint = isolationLevel 
    ? `${API_URL}/tickets/${ticketId}/release-${isolationLevel.toLowerCase()}`
    : `${API_URL}/tickets/${ticketId}/release`;
  
  logInfo(`Releasing ${quantity} tickets using ${isolationLevel || 'default'} isolation level...`);
  
  try {
    const response = await axios.post(endpoint, { quantity });
    logSuccess(`Release successful! New quantity: ${response.data.quantity}`);
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message;
    
    if (status === 423) {
      logError(`Release failed: Resource is locked by another transaction`);
    } else {
      logError(`Release failed: ${message}`);
    }
    
    throw error;
  }
}

async function runWithTimeout(promise, timeoutMs) {
  let timeoutId;
  
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });
  
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timeoutId);
  }
}

async function testIsolationLevel(isolationLevel, description) {
  logHeader(`Testing ${isolationLevel} Isolation Level`);
  logInfo(description);
  
  const ticket = await getTicket(TEST_TICKET_ID);
  logInfo(`Initial state: ID=${ticket.id}, Quantity=${ticket.quantity}`);
  
  const operations = [];
  
  operations.push(
    bookTicket(TEST_TICKET_ID, 1, isolationLevel)
      .then(updatedTicket => ({ success: true, type: 'book', result: updatedTicket }))
      .catch(error => ({ success: false, type: 'book', error: error.message }))
  );
  
  operations.push(
    runWithTimeout(
      bookTicket(TEST_TICKET_ID, 1, isolationLevel)
        .then(updatedTicket => ({ success: true, type: 'book', result: updatedTicket }))
        .catch(error => ({ success: false, type: 'book', error: error.message })),
      5000
    ).catch(error => ({ success: false, type: 'book', error: error.message }))
  );
  
  const results = await Promise.all(operations);
  const finalTicket = await getTicket(TEST_TICKET_ID);
  logInfo(`Final state: ID=${finalTicket.id}, Quantity=${finalTicket.quantity}`);
  
  const successfulOps = results.filter(r => r.success).length;
  logInfo(`${successfulOps} of ${operations.length} operations succeeded`);
  
  const ticketsBooked = results.filter(r => r.success && r.type === 'book').length;
  if (ticketsBooked > 0) {
    await releaseTicket(TEST_TICKET_ID, ticketsBooked, isolationLevel);
  }
  
  return {
    isolationLevel,
    initialQuantity: ticket.quantity,
    finalQuantity: finalTicket.quantity,
    successfulOperations: successfulOps,
    results
  };
}

async function testAllIsolationLevels() {
  const isolationLevels = [
    {
      name: 'READ UNCOMMITTED',
      description: 'Lowest isolation level. Transactions can read uncommitted changes from other transactions. Prone to dirty reads, non-repeatable reads, and phantoms.'
    },
    {
      name: 'READ COMMITTED',
      description: 'Only committed changes are visible to other transactions. Prevents dirty reads, but non-repeatable reads and phantoms can still occur.'
    },
    {
      name: 'REPEATABLE READ',
      description: 'Ensures repeated reads within a transaction return the same result. Prevents dirty reads and non-repeatable reads, but phantoms can still occur.'
    },
    {
      name: 'SERIALIZABLE',
      description: 'Highest isolation level. Transactions are completely isolated from each other. Prevents all concurrency anomalies but has the lowest concurrency.'
    }
  ];
  
  const results = [];
  
  for (const level of isolationLevels) {
    try {
      const result = await testIsolationLevel(level.name, level.description);
      results.push(result);
    } catch (error) {
      logError(`Failed to test ${level.name}: ${error.message}`);
      results.push({
        isolationLevel: level.name,
        error: error.message
      });
    }
  }
  
  return results;
}

async function testPessimisticVsOptimistic() {
  logHeader('Comparing Pessimistic vs Optimistic Locking');
  
  const ticket = await getTicket(TEST_TICKET_ID);
  logInfo(`Initial state: ID=${ticket.id}, Quantity=${ticket.quantity}`);
  
  logInfo('Testing pessimistic locking with concurrent operations...');
  const pessimisticResults = await Promise.all([
    bookTicket(TEST_TICKET_ID, 1)
      .then(result => ({ success: true, type: 'pessimistic', result }))
      .catch(error => ({ success: false, type: 'pessimistic', error: error.message })),
    bookTicket(TEST_TICKET_ID, 1)
      .then(result => ({ success: true, type: 'pessimistic', result }))
      .catch(error => ({ success: false, type: 'pessimistic', error: error.message }))
  ]);
  
  const ticketsBooked = pessimisticResults.filter(r => r.success).length;
  if (ticketsBooked > 0) {
    await releaseTicket(TEST_TICKET_ID, ticketsBooked);
  }
  
  logInfo('Testing optimistic locking with concurrent operations...');
  const optimisticResults = await Promise.all([
    bookTicket(TEST_TICKET_ID, 1, 'OPTIMISTIC')
      .then(result => ({ success: true, type: 'optimistic', result }))
      .catch(error => ({ success: false, type: 'optimistic', error: error.message })),
    bookTicket(TEST_TICKET_ID, 1, 'OPTIMISTIC')
      .then(result => ({ success: true, type: 'optimistic', result }))
      .catch(error => ({ success: false, type: 'optimistic', error: error.message }))
  ]);
  
  const optimisticTicketsBooked = optimisticResults.filter(r => r.success).length;
  if (optimisticTicketsBooked > 0) {
    await releaseTicket(TEST_TICKET_ID, optimisticTicketsBooked, 'OPTIMISTIC');
  }
  
  const successfulPessimistic = pessimisticResults.filter(r => r.success).length;
  const successfulOptimistic = optimisticResults.filter(r => r.success).length;
  
  logInfo(`Pessimistic locking: ${successfulPessimistic} of ${pessimisticResults.length} operations succeeded`);
  logInfo(`Optimistic locking: ${successfulOptimistic} of ${optimisticResults.length} operations succeeded`);
  
  return {
    pessimistic: pessimisticResults,
    optimistic: optimisticResults
  };
}

async function main() {
  logHeader('Transaction Isolation Level Testing');
  
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
      logInfo('You can create a ticket with: curl -X POST http://localhost:3000/tickets -H "Content-Type: application/json" -d \'{"title": "Test Ticket", "description": "For transaction isolation test", "price": 100, "quantity": 10}\'');
      return;
    }
    
    await testPessimisticVsOptimistic();
    await testAllIsolationLevels();
    
    logHeader('Testing Complete');
  } catch (error) {
    logError(`Failed to connect to API: ${error.message}`);
    logInfo('Make sure the application is running on http://localhost:3000');
  }
}

main().catch(error => {
  logError(`Unhandled error: ${error.message}`);
  process.exit(1);
}); 