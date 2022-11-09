import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const Web3 = require('web3');
import * as TOKEN_ABI_JSON from './abi.json';

@Injectable()
export class AppService {
  appEnv = this.configService.get('appEnv');
  baseUrl = this.configService.get('baseUrl');
  apiKey = this.configService.get('apiKey');
  audience = this.configService.get('audience');
  clientId = this.configService.get('clientId');
  clientSecret = this.configService.get('clientSecret');
  accessToken = this.configService.get('accessToken');

  rpcEndpoint = this.configService.get('rpcEndpoint');
  walletAddress = this.configService.get('walletAddress');
  walletPrivateKey = this.configService.get('walletPrivateKey');
  contractAddress = this.configService.get('contractAddress');

  web3Provider = new Web3(this.configService.get('rpcEndpoint'));

  contract = new this.web3Provider.eth.Contract(
    TOKEN_ABI_JSON as any,
    this.contractAddress,
  );

  eventTokens = [];
  poapIds = [];

  constructor(
    private configService: ConfigService,
    private readonly httpService: HttpService,
  ) {
    this.web3Provider.eth.accounts.wallet.add(this.walletPrivateKey);

    // get wallet balance
    this.web3Provider.eth
      .getBalance(this.walletAddress)
      .then((balance) =>
        console.log(
          'Wallet balance: ' +
            this.web3Provider.utils.fromWei(balance, 'ether') +
            ' ETH',
        ),
      );
  }

  getHello(): string {
    return 'Hello World!';
  }

  // fetch accessToken every 12 hours
  @Cron('0 */12 * * *')
  fetchAccessToken() {
    if (this.appEnv === 'production') {
      const url = 'https://poapauth.auth0.com/oauth/token';
      const body = `grant_type=client_credentials&client_id=${this.clientId}&client_secret=${this.clientSecret}&audience=${this.audience}`;

      this.httpService
        .post(url, body, {
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
        })
        .subscribe((res) => {
          this.accessToken = res.data.access_token;
        });
    }
  }

  // fetch token holders every minute
  @Cron('* * * * * *')
  fetchHolders() {
    const tokenCount = this.eventTokens.length || 0;
    const url =
      this.baseUrl + `/event/79022/poaps?limit=300&offset=${tokenCount}`;

    this.httpService
      .get(url, {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
          'X-API-Key': this.apiKey,
          accept: 'application/json',
        },
      })
      .subscribe((res) => {
        this.eventTokens = this.eventTokens.concat(res.data.tokens);
      });
  }

  // fetch for new poaps from holders every minute
  @Cron('* * * * *')
  fetchNewPoaps() {
    if (!this.eventTokens || this.eventTokens.length < 1) {
      return;
    }

    for (const eventToken of this.eventTokens) {
      const url = this.baseUrl + `/actions/scan/${eventToken.owner.id}`;

      this.httpService
        .get(url, { headers: { 'X-API-Key': this.apiKey } })
        .subscribe((res) => {
          for (const poap of res.data) {
            if (
              poap.created > eventToken.created &&
              !this.poapIds.includes(poap.id)
            ) {
              this.poapIds.push(poap.tokenId);

              const random = Math.floor(Math.random() * 500);

              if (random < 100) {
                console.log('sending poap');

                // mint nft to user address using wallet private key
                try {
                  this.contract.methods
                    .safeMint(eventToken.owner.id, 'url')
                    .send({
                      from: this.walletAddress,
                      gas: 1000000,
                    })
                    .then((receipt) => {
                      console.log(
                        'Minted NFT to user address',
                        eventToken.owner.id,
                        receipt,
                      );
                    });
                } catch (error) {
                  console.log(error);
                }
              }
            }
          }
        });
    }
  }
}
