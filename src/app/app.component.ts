import { FormGroup, FormBuilder, FormControl, Validators } from '@angular/forms';
import { Component, OnInit } from '@angular/core';
import { HeliosService } from './service/helios.service';
import * as moment from 'moment';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent implements OnInit {
  title = 'get-balance-helios';
  addressform: FormGroup;
  address: any;
  error: boolean;
  errorMsg: any;
  result: boolean = false;
  spinner: boolean = false;
  fromTx: any;
  toTx: any;
  transactions: any[] = [];
  addressArray = [];
  tx: any;
  constructor(
    private formBuilder: FormBuilder,
    private heliosService: HeliosService
    ){
  }
  ngOnInit() {
    this.addressform = this.formBuilder.group({
      address: new FormControl('', [Validators.required]),
    });

    if(localStorage.getItem('address')) {
      this.addressform.controls['address'].setValue(localStorage.getItem('form'));
      const addressStorage = JSON.parse(localStorage.getItem('address'));
      for ( const address of addressStorage ) {
        this.addressArray.push({'address': address.address, 'balance': address.balance,
        'date': address.date});
      }
      this.address = this.addressArray;
      this.result = true;
    }
  }

  async searchBalance(){
    this.error = false;
    try {
      this.spinner = true;
      this.addressArray = [];
      for (const address of JSON.parse(this.addressform.value.address)) {
        const balance = await this.heliosService.getBalance( address );
        const transactions = await this.loadTransaction( address );
        this.addressArray.push({'address': address, 'balance': balance, 'date': moment(transactions[0].timestamp).format('YYYY-MM-DD')});
      }
      this.address = this.addressArray;
      localStorage.setItem('address', JSON.stringify(this.addressArray));
      this.spinner = false;
      this.result = true;
    } catch (error) {
      this.spinner = false;
      this.error = true;
      this.errorMsg = error.message;
      console.log( error.message );
    }
  }

  async loadTransaction( wallet ) {
    try {
      const startDate = moment().utc().subtract(12, 'months').valueOf();
      const endDate = moment().utc().valueOf();
      this.fromTx = this.fromTx + 11 ;
      this.toTx = this.toTx + 10;
      const transactionsPromises = [];

      try {
        await this.heliosService.connectToFirstAvailableNode();
        transactionsPromises.push(
            new Promise(async (resolve, reject) => {
              try {
                const tx = await this.heliosService.getAllTransactions( wallet , startDate , endDate, this.fromTx, this.toTx);
                this.transactions = this.transactions.concat(tx.map( data => {
                  data.timestamp = moment.unix(data.timestamp);
                  return data;
                }));
                this.tx = tx;
                resolve();
              } catch (error) {
                reject(error);
              }
          }));
        await Promise.all(transactionsPromises);
        return this.tx.filter( receive => receive.description === 'Receive transaction');
      } catch (error) {
        console.log( error );
        }
    } catch (error) {
      console.log( error );
    }
  }

  changeTextArea(){
    localStorage.setItem('form', this.addressform.value.address);
  }
}
