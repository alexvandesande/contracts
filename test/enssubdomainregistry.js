const utils = require('../utils/testUtils.js');
const web3Utils = require('web3-utils');
const namehash = require('eth-ens-namehash');

contract('ENSSubdomainRegistry', function () {
    this.timeout(0);
    let domains = {
        free : {
            name: 'freedomain.eth',
            price: 0,
            namehash: namehash.hash('freedomain.eth')
        },
        paid : {
            name: 'stateofus.eth',
            price: 100000000,
            namehash: namehash.hash('stateofus.eth')
        }
    }
    let ens;
    let accountsArr;

    before(function(done) {
        var contractsConfig = {
            "TestToken": {
            
            },
            "ENSRegistry": {
            
            },
            "PublicResolver": {
                "args": [
                    "$ENSRegistry"
                ]
            },
            "ENSSubdomainRegistry": {
                "args": [
                    "$TestToken", 
                    "$ENSRegistry",
                    "$PublicResolver",
                    "0x0"
                ]
            },
            "UpdatedENSSubdomainRegistry": {
                "instanceOf" : "ENSSubdomainRegistry",
                "args": [
                    "$TestToken", 
                    "$ENSRegistry",
                    "$PublicResolver",
                    "$ENSSubdomainRegistry"
                ]
            }

        };
        EmbarkSpec.deployAll(contractsConfig, async (accounts) => { 
          ens = ENSRegistry;
          accountsArr = accounts; 
          await utils.increaseTime(1 * utils.timeUnits.days) //time cannot start zero
          await ens.methods.setSubnodeOwner(utils.zeroBytes32, web3Utils.sha3('eth'), accountsArr[0]).send({from: accountsArr[0]});
          await ens.methods.setSubnodeOwner(namehash.hash('eth'), web3Utils.sha3('stateofus'), ENSSubdomainRegistry.address).send({from: accountsArr[0]});
          await ens.methods.setSubnodeOwner(namehash.hash('eth'), web3Utils.sha3('freedomain'), ENSSubdomainRegistry.address).send({from: accountsArr[0]});
          done()
        });
      });

      it('should add free domain', async () => {
        let result = await ENSSubdomainRegistry.methods.addDomain(domains.free.namehash, 0).send({from: accountsArr[0]});       
        assert.equal(result.events.DomainPrice.returnValues.price, domains.free.price);
        assert.equal(result.events.DomainPrice.returnValues.namehash, domains.free.namehash);
        result = await ENSSubdomainRegistry.methods.getPrice(domains.free.namehash).call()
        assert.equal(result, 0);
    });
    
    it('should add paid domain', async () => {
        let initialPrice = 100
        let result = await ENSSubdomainRegistry.methods.addDomain(domains.paid.namehash, initialPrice).send({from: accountsArr[0]});       
        assert.equal(result.events.DomainPrice.returnValues.price, initialPrice);
        assert.equal(result.events.DomainPrice.returnValues.namehash, domains.paid.namehash);
        result = await ENSSubdomainRegistry.methods.getPrice(domains.paid.namehash).call()
        assert.equal(result, initialPrice);
    });

    it('should change paid domain price', async () => {
        let newPrice = domains.paid.price;
        let result = await ENSSubdomainRegistry.methods.setDomainPrice(domains.paid.namehash, newPrice).send({from: accountsArr[0]});       
        assert.equal(result.events.DomainPrice.returnValues.price, newPrice, "Wrong price at event");
        assert.equal(result.events.DomainPrice.returnValues.namehash, domains.paid.namehash, "Wrong namehash at event");
        result = await ENSSubdomainRegistry.methods.getPrice(domains.paid.namehash).call()
        assert.equal(result, newPrice, "Wrong return value at getPrice");
    });


    it('should register free subdomain', async () => {
        let subdomain = 'alice';
        let usernameHash = namehash.hash(subdomain + '.' + domains.free.name);
        let registrant = accountsArr[1];
        let result = await ENSSubdomainRegistry.methods.register(
            web3Utils.sha3(subdomain), 
            domains.free.namehash,
            utils.zeroAddress,
            utils.zeroBytes32,
            utils.zeroBytes32
        ).send({from: registrant});     

        //TODO: check events

        result = await ens.methods.owner(usernameHash).call()
        assert.equal(result, registrant);
        result = await ens.methods.resolver(usernameHash).call()
        assert.equal(result, utils.zeroAddress);
        let accountBalance = await ENSSubdomainRegistry.methods.getAccountBalance(usernameHash).call();
        assert(accountBalance, 0, "Registry subdomain account balance wrong");
        result = await ENSSubdomainRegistry.methods.getFundsOwner(usernameHash).call();
        assert(result, registrant, "Backup owner not set");
    });

    it('should register free address only resolver-defined subdomain', async () => {
        let registrant = accountsArr[2];
        let subdomain = 'bob';
        let usernameHash = namehash.hash(subdomain + '.' + domains.free.name);
        let result = await ENSSubdomainRegistry.methods.register(
            web3Utils.sha3(subdomain), 
            domains.free.namehash,
            registrant,
            utils.zeroBytes32,
            utils.zeroBytes32
        ).send({from: registrant});
 
        //TODO: check events
        
        result = await ens.methods.owner(usernameHash).call()
        assert.equal(result, registrant, "Owner not set");
        result = await ens.methods.resolver(usernameHash).call()
        assert.equal(result, PublicResolver.address, "PublicResolver not set");
        result = await PublicResolver.methods.addr(usernameHash).call()
        assert.equal(result, registrant, "Resolved address not set");
        result = await PublicResolver.methods.pubkey(usernameHash).call()
        assert.equal(result[0], utils.zeroBytes32, "Unexpected resolved pubkey[0]");
        assert.equal(result[1], utils.zeroBytes32, "Unexpected resolved pubkey[1]");
    });

    it('should register free pubkey only resolver-defined subdomain', async () => {
        let subdomain = 'carlos';
        let registrant = accountsArr[3];
        let usernameHash = namehash.hash(subdomain + '.' + domains.free.name);
        let pubkey = [web3Utils.sha3("0"), web3Utils.sha3("1")];
        let result = await ENSSubdomainRegistry.methods.register(
            web3Utils.sha3(subdomain), 
            domains.free.namehash,
            utils.zeroAddress,
            pubkey[0],
            pubkey[1]
        ).send({from: registrant});  

        //TODO: check events

        result = await ens.methods.owner(usernameHash).call()
        assert.equal(result, registrant, "Owner not set");
        result = await ens.methods.resolver(usernameHash).call()
        assert.equal(result, PublicResolver.address, "PublicResolver not set");
        result = await PublicResolver.methods.addr(usernameHash).call()
        assert.equal(result, utils.zeroAddress, "Resolved address unexpectedlly set");
        result = await PublicResolver.methods.pubkey(usernameHash).call()
        assert.equal(result[0], pubkey[0], "Resolved pubkey[0] not set");
        assert.equal(result[1], pubkey[1], "Resolved pubkey[1] not set");
    });

    
    it('should register free full resolver-defined subdomain', async () => {
        let registrant = accountsArr[4];
        let subdomain = 'david';
        let usernameHash = namehash.hash(subdomain + '.' + domains.free.name);
        let pubkey = [web3Utils.sha3("2"), web3Utils.sha3("3")];
        
        let result = await ENSSubdomainRegistry.methods.register(
            web3Utils.sha3(subdomain), 
            domains.free.namehash,
            registrant,
            pubkey[0],
            pubkey[1]
        ).send({from: registrant});    
     
        //TODO: check events

        result = await ens.methods.owner(usernameHash).call()
        assert.equal(result, registrant, "Owner not set");
        result = await ens.methods.resolver(usernameHash).call()
        assert.equal(result, PublicResolver.address, "PublicResolver not set");
        result = await PublicResolver.methods.addr(usernameHash).call()
        assert.equal(result, registrant, "Resolved address not set");
        result = await PublicResolver.methods.pubkey(usernameHash).call()
        assert.equal(result[0], pubkey[0], "Resolved pubkey[0] not set");
        assert.equal(result[1], pubkey[1], "Resolved pubkey[1] not set");
    });

    it('should release free subdomain', async () => {
        let registrant = accountsArr[6];
        let subdomain = 'frank';
        let usernameHash = namehash.hash(subdomain + '.' + domains.free.name);
        
        await ENSSubdomainRegistry.methods.register(
            web3Utils.sha3(subdomain), 
            domains.free.namehash,
            utils.zeroAddress,
            utils.zeroBytes32,
            utils.zeroBytes32
        ).send({from: registrant});  
        let releaseDelay = await ENSSubdomainRegistry.methods.releaseDelay().call();
        await utils.increaseTime(releaseDelay)

        let initialRegistrantBalance = await TestToken.methods.balanceOf(registrant).call();
        let initialRegistryBalance = await TestToken.methods.balanceOf(ENSSubdomainRegistry.address).call();
        
        let result = await ENSSubdomainRegistry.methods.release(
            web3Utils.sha3(subdomain), 
            domains.free.namehash
        ).send({from: registrant});

        //TODO: check events

        result = await ens.methods.owner(usernameHash).call()
        assert.equal(result, utils.zeroAddress, "Not released name ownship");
        let finalRegistrantBalance = await TestToken.methods.balanceOf(registrant).call();
        assert(finalRegistrantBalance, initialRegistrantBalance, "Registrant token balance unexpectectly changed")
        let finalRegistryBalance = await TestToken.methods.balanceOf(ENSSubdomainRegistry.address).call();
        assert(finalRegistryBalance, initialRegistryBalance, "Registry token balance unexpectectly changed")
        
    });
    
    it('should register empty subdomain with token cost', async () => {
        let registrant = accountsArr[5];
        let subdomain = 'erin';
        let usernameHash = namehash.hash(subdomain + '.' + domains.paid.name);
        let domainPrice = await ENSSubdomainRegistry.methods.getPrice(domains.paid.namehash).call()
        await TestToken.methods.mint(domainPrice).send({from: registrant});

        let initialRegistrantBalance = await TestToken.methods.balanceOf(registrant).call();
        let initialRegistryBalance = await TestToken.methods.balanceOf(ENSSubdomainRegistry.address).call();
        
        await TestToken.methods.approve(ENSSubdomainRegistry.address, domainPrice).send({from: registrant});

        let result = await ENSSubdomainRegistry.methods.register(
            web3Utils.sha3(subdomain), 
            domains.paid.namehash,
            utils.zeroAddress,
            utils.zeroBytes32,
            utils.zeroBytes32
        ).send({from: registrant});       

        //TODO: check events
 
        result = await ens.methods.owner(namehash.hash(subdomain + '.' + domains.paid.name)).call()
        assert.equal(result, registrant);
        result = await ens.methods.resolver(namehash.hash(subdomain + '.' + domains.paid.name)).call()
        assert.equal(result, utils.zeroAddress);

        let accountBalance = await ENSSubdomainRegistry.methods.getAccountBalance(usernameHash).call();
        assert(accountBalance, domainPrice, "Registry subdomain account balance wrong");
        let finalRegistrantBalance = await TestToken.methods.balanceOf(registrant).call();
        assert(finalRegistrantBalance, +initialRegistrantBalance-domainPrice, "User final balance wrong")
        let finalRegistryBalance = await TestToken.methods.balanceOf(ENSSubdomainRegistry.address).call();
        assert(finalRegistryBalance, +finalRegistryBalance+domainPrice, "Registry final balance wrong")
        
    });


    it('should release subdomain with cost', async () => {;
        let registrant = accountsArr[6];
        let subdomain = 'frank';
        let usernameHash = namehash.hash(subdomain + '.' + domains.paid.name);
        let labelHash = web3Utils.sha3(subdomain);
        let domainPrice = await ENSSubdomainRegistry.methods.getPrice(domains.paid.namehash).call()
        await TestToken.methods.mint(domainPrice).send({from: registrant});
        await TestToken.methods.approve(ENSSubdomainRegistry.address, domainPrice).send({from: registrant});
        let result = await ENSSubdomainRegistry.methods.register(
            labelHash, 
            domains.paid.namehash,
            utils.zeroAddress,
            utils.zeroBytes32,
            utils.zeroBytes32
        ).send({from: registrant});  

        //TODO: check events
        
        let releaseDelay = await ENSSubdomainRegistry.methods.releaseDelay().call();
        utils.increaseTime(releaseDelay)
        
        let initialAccountBalance = await ENSSubdomainRegistry.methods.getAccountBalance(usernameHash).call();
        let initialRegistrantBalance = await TestToken.methods.balanceOf(registrant).call();
        let initialRegistryBalance = await TestToken.methods.balanceOf(ENSSubdomainRegistry.address).call();
        
        await ENSSubdomainRegistry.methods.release(
            web3Utils.sha3(subdomain), 
            domains.paid.namehash
        ).send({from: registrant});       
        let finalAccountBalance = await ENSSubdomainRegistry.methods.getAccountBalance(usernameHash).call();
        assert(finalAccountBalance, 0, "Final balance didnt zeroed");
        let finalRegistrantBalance = await TestToken.methods.balanceOf(registrant).call();
        assert(finalRegistrantBalance, +initialRegistrantBalance+initialAccountBalance, "Releaser token balance didnt increase")
        let finalRegistryBalance = await TestToken.methods.balanceOf(ENSSubdomainRegistry.address).call();
        assert(finalRegistryBalance, +initialRegistryBalance-initialAccountBalance, "Registry token balance didnt decrease")
        
    });

    it('should release transfered subdomain with cost', async () => {
        let registrant = accountsArr[7];
        let subdomain = 'grace';
        let usernameHash = namehash.hash(subdomain + '.' + domains.paid.name);
        let labelHash = web3Utils.sha3(subdomain);
        let newOwner = accountsArr[8];

        let domainPrice = await ENSSubdomainRegistry.methods.getPrice(domains.paid.namehash).call()
        await TestToken.methods.mint(domainPrice).send({from: registrant});
        await TestToken.methods.approve(ENSSubdomainRegistry.address, domainPrice).send({from: registrant});
        await ENSSubdomainRegistry.methods.register(
            labelHash, 
            domains.paid.namehash,
            utils.zeroAddress,
            utils.zeroBytes32,
            utils.zeroBytes32
        ).send({from: registrant});       
        await ens.methods.setOwner(usernameHash, newOwner).send({from: registrant});

        let releaseDelay = await ENSSubdomainRegistry.methods.releaseDelay().call();
        await utils.increaseTime(releaseDelay)

        let initialAccountBalance = await ENSSubdomainRegistry.methods.getAccountBalance(usernameHash).call();
        let initialRegistrantBalance = await TestToken.methods.balanceOf(newOwner).call();
        let initialRegistryBalance = await TestToken.methods.balanceOf(ENSSubdomainRegistry.address).call();
                
        let result = await ENSSubdomainRegistry.methods.release(
            web3Utils.sha3(subdomain), 
            domains.paid.namehash
        ).send({from: newOwner});       
        
        //TODO: check events
        
        let finalAccountBalance = await ENSSubdomainRegistry.methods.getAccountBalance(usernameHash).call();
        assert(finalAccountBalance, 0, "Final balance didnt zeroed");
        let finalRegistrantBalance = await TestToken.methods.balanceOf(newOwner).call();
        assert(finalRegistrantBalance, +initialRegistrantBalance+initialAccountBalance, "New owner token balance didnt increase")
        let finalRegistryBalance = await TestToken.methods.balanceOf(ENSSubdomainRegistry.address).call();
        assert(finalRegistryBalance, +initialRegistryBalance-initialAccountBalance, "Registry token balance didnt decrease")
        
    });

    it('should update subdomain funds owner', async () => {
        let subdomain = 'heidi';
        let labelHash = web3Utils.sha3(subdomain);
        let registrant = accountsArr[8];
        let newOwner = accountsArr[9];
        let usernameHash = namehash.hash(subdomain + '.' + domains.paid.name);
        let domainPrice = await ENSSubdomainRegistry.methods.getPrice(domains.paid.namehash).call()
        await TestToken.methods.mint(domainPrice).send({from: registrant});
        await TestToken.methods.approve(ENSSubdomainRegistry.address, domainPrice).send({from: registrant});
        await ENSSubdomainRegistry.methods.register(
            labelHash, 
            domains.paid.namehash,
            utils.zeroAddress,
            utils.zeroBytes32,
            utils.zeroBytes32
        ).send({from: registrant});       
        await ens.methods.setOwner(usernameHash, newOwner).send({from: registrant});

        let result = await ENSSubdomainRegistry.methods.updateFundsOwner(
            labelHash,
            domains.paid.namehash
        ).send({from: newOwner});       
        
        //TODO: check events
        
        result = await ENSSubdomainRegistry.methods.getFundsOwner(usernameHash).call();
        assert(result, newOwner, "Backup owner not updated");
    });


    it('should move domain to new registry and migrate', async () => {
        let price = await ENSSubdomainRegistry.methods.getPrice(domains.paid.namehash).call()
        let result = await ENSSubdomainRegistry.methods.moveDomain(UpdatedENSSubdomainRegistry.address, domains.paid.namehash).send();
        
        //TODO: check events
        
        result = await ens.methods.owner(domains.paid.namehash).call()
        assert(result, UpdatedENSSubdomainRegistry.address, "domain ownership not moved correctly")
        result = await UpdatedENSSubdomainRegistry.methods.getPrice(domains.paid.namehash).call()
        assert(result, price, "updated registry didnt migrated price")
    });

    xit('should release moved free subdomain account balance by funds owner', async () => {
        
    });

    xit('should migrate free subdomain to new registry by funds owner', async () => {
        
    });

    xit('should release moved paid subdomain account balance by funds owner', async () => {
        
    });

    xit('should migrate paid subdomain to new registry by funds owner', async () => {
        
    });
    
});