// 📁 check-controllers.js
const contactGroupController = require('./src/controllers/contactGroupController');
const authController = require('./src/controllers/authController');
const whatsappController = require('./src/controllers/whatsappController');
const batchController = require('./src/controllers/batchController');

console.log('🔍 VERIFICANDO CONTROLLERS:');
console.log('==========================');

console.log('\n📋 contactGroupController:');
console.log('- createContactGroup:', typeof contactGroupController.createContactGroup);
console.log('- getContactGroups:', typeof contactGroupController.getContactGroups);
console.log('- getContactGroup:', typeof contactGroupController.getContactGroup);
console.log('- updateContactGroup:', typeof contactGroupController.updateContactGroup);
console.log('- deleteContactGroup:', typeof contactGroupController.deleteContactGroup);
console.log('- addContactsToGroup:', typeof contactGroupController.addContactsToGroup);

console.log('\n🔐 authController:');
console.log('- register:', typeof authController.register);
console.log('- login:', typeof authController.login);
console.log('- getProfile:', typeof authController.getProfile);

console.log('\n📱 whatsappController:');
console.log('- createInstance:', typeof whatsappController.createInstance);
console.log('- getInstances:', typeof whatsappController.getInstances);
console.log('- getInstance:', typeof whatsappController.getInstance);
console.log('- deleteInstance:', typeof whatsappController.deleteInstance);
console.log('- getQRCode:', typeof whatsappController.getQRCode);
console.log('- disconnectInstance:', typeof whatsappController.disconnectInstance);
console.log('- loadGroups:', typeof whatsappController.loadGroups);
console.log('- getGroups:', typeof whatsappController.getGroups);
console.log('- getInstanceStatus:', typeof whatsappController.getInstanceStatus);

console.log('\n📨 batchController:');
console.log('- createBatch:', typeof batchController.createBatch);
console.log('- getBatches:', typeof batchController.getBatches);
console.log('- getBatch:', typeof batchController.getBatch);
console.log('- cancelBatch:', typeof batchController.cancelBatch);
console.log('- processBatch:', typeof batchController.processBatch);