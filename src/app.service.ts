import { HttpService } from '@nestjs/axios';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';

@Injectable()
export class AppService {
  constructor(private configService: ConfigService, private readonly httpService: HttpService) { }
  appEnv = this.configService.get('appEnv');
  baseUrl = this.configService.get('baseUrl');
  apiKey = this.configService.get('apiKey');
  audience = this.configService.get('audience');
  clientId = this.configService.get('clientId');
  clientSecret = this.configService.get('clientSecret');
  accessToken = this.configService.get('accessToken');

  eventTokens = []

  getHello(): string {
    return 'Hello World!';
  }

  // fetch accessToken - every 12 hours
  @Cron('0 */12 * * *')
  fetchAccessToken() {
    if (this.appEnv === 'production') {
      const url = 'https://poapauth.auth0.com/oauth/token';
      const body = `grant_type=client_credentials&client_id=${this.clientId}&client_secret=${this.clientSecret}&audience=${this.audience}`;

      this.httpService.post(url, body, { headers: { 'content-type': 'application/x-www-form-urlencoded' } })
        .subscribe((res) => {
          this.accessToken = res.data.access_token;
          console.log('accessToken: ', this.accessToken);
        }
        );
    }
  }

  // fetch token holders every minute
  @Cron('* * * * * *')
  fetchHolders() {
    const tokenCount = this.eventTokens.length || 0;
    const url = this.baseUrl + `/event/79022/poaps?limit=300&offset=${tokenCount}`;

    this.httpService.get(url, { headers: { 'Authorization': `Bearer ${this.accessToken}`, 'X-API-Key': this.apiKey, 'accept': 'application/json' } })
      .subscribe((res) => {
        this.eventTokens = this.eventTokens.concat(res.data.tokens);
      });
  }

  // fetch for new poaps from holders every minute
  @Cron('* * * * * *')
  fetchNewPoaps() {
    if (!this.eventTokens || this.eventTokens.length < 1) {
      return;
    }

    for (const eventToken of this.eventTokens) {
      console.log('owner: ', eventToken.owner);
      const url = this.baseUrl + `/actions/scan/${eventToken.owner.id}`;

      this.httpService.get(url, { headers: { 'X-API-Key': this.apiKey } })
        .subscribe((res) => {
          for (const poap of res.data) {
            if (poap.created > eventToken.created) {
              console.log('new poap: ', poap);
            }
          }
        });
    }
  }
}
