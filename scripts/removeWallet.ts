import { prisma } from '../src/db';

async function removeWallet() {
  const walletAddress = 'Ge8xkdPrPU2tP22nKWBHocCZ6ezfHTLGHZzLsPmEtozH';
  
  console.log(`Checking data for wallet: ${walletAddress}`);
  
  const transfers = await prisma.transferEvent.findMany({
    where: { walletAddress },
  });
  
  console.log(`Found ${transfers.length} transfer records`);
  
  if (transfers.length > 0) {
    console.log('\nDeleting records...');
    const result = await prisma.transferEvent.deleteMany({
      where: { walletAddress }
    });
    
    console.log(`✅ Deleted ${result.count} transfer records`);
  } else {
    console.log('No records found for this wallet');
  }
  
  await prisma.$disconnect();
}

removeWallet().catch(console.error);
