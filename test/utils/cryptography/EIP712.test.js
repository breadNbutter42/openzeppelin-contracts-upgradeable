const { ethers } = require('hardhat');
const { getDomain, domainType, domainSeparator, hashTypedData } = require('../../helpers/eip712');
const { getChainId } = require('../../helpers/chainid');
const { mapValues } = require('../../helpers/iterate');

const EIP712Verifier = artifacts.require('$EIP712Verifier');
const Clones = artifacts.require('$Clones');

contract('EIP712', function (accounts) {
  const [mailTo] = accounts;

  const shortName = 'A Name';
  const shortVersion = '1';

  const longName = 'A'.repeat(40);
  const longVersion = 'B'.repeat(40);

  const cases = [
    ['short', shortName, shortVersion],
    ['long', longName, longVersion],
  ];

  for (const [shortOrLong, name, version] of cases) {
    describe(`with ${shortOrLong} name and version`, function () {
      beforeEach('deploying', async function () {
        this.eip712 = await EIP712Verifier.new(name, version);

        this.domain = {
          name,
          version,
          chainId: await getChainId(),
          verifyingContract: this.eip712.address,
        };
        this.domainType = domainType(this.domain);
      });

      describe('domain separator', function () {
        it('is internally available', async function () {
          const expected = await domainSeparator(this.domain);

          expect(await this.eip712.$_domainSeparatorV4()).to.equal(expected);
        });

        it("can be rebuilt using EIP-5267's eip712Domain", async function () {
          const rebuildDomain = await getDomain(this.eip712);
          expect(mapValues(rebuildDomain, String)).to.be.deep.equal(mapValues(this.domain, String));
        });
      });

      it('hash digest', async function () {
        const structhash = web3.utils.randomHex(32);
        expect(await this.eip712.$_hashTypedDataV4(structhash)).to.be.equal(hashTypedData(this.domain, structhash));
      });

      it('digest', async function () {
        const message = {
          to: mailTo,
          contents: 'very interesting',
        };

        const types = {
          Mail: [
            { name: 'to', type: 'address' },
            { name: 'contents', type: 'string' },
          ],
        };

        const signer = ethers.Wallet.createRandom();
        const address = await signer.getAddress();
        const signature = await signer.signTypedData(this.domain, types, message);

        await this.eip712.verify(signature, address, message.to, message.contents);
      });

      it('name', async function () {
        expect(await this.eip712.$_EIP712Name()).to.be.equal(name);
      });

      it('version', async function () {
        expect(await this.eip712.$_EIP712Version()).to.be.equal(version);
      });
    });
  }
});
