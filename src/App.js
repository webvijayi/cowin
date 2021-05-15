/* eslint-disable array-callback-return */
import "./App.css";
// import { Notifications } from "react-push-notification";
import { Button, Col, Input, Row, Radio, Select, Checkbox, Tabs, Modal, Typography, notification } from "antd";
import { CloseCircleOutlined } from "@ant-design/icons";
import React from "react";
import CowinApi from "./models";
import walletImage from './wallet.png'
import PayTMQR from './OfflineMerchant.png'
// import captcha from './captcha.json';
import parseHTML from 'html-react-parser';
import privacy from './privacy';

import moment from "moment";
import {
  FacebookShareButton,
  WhatsappShareButton,
  TwitterShareButton,
  LinkedinShareButton,
  TelegramShareButton,
  RedditShareButton,
  FacebookIcon,
  LinkedinIcon,
  WhatsappIcon,
  TwitterIcon,
  RedditIcon,
  TelegramIcon

} from "react-share"
const { Text } = Typography;
const { TabPane } = Tabs;
const cowinApi = new CowinApi();
const { Search } = Input;
const { Option } = Select;       

const promosg = {
  text: 'Use this link to track vaccine availability and automatically book a slot for you and your family.',
  title: 'Automated vaccine booking and availability tracking',
  tags: ['covid19vaccines', 'covid19help', 'vaccination2021', 'covid19india'],
  url: window.location.href.indexOf('localhost') ? 'https://cowinbook.netlify.app/' : window.location.href
}

const metas = document.getElementsByTagName("meta");
const version = metas[metas.length-1].getAttribute("build-version");

class App extends React.Component{
  constructor(props) {
    super(props);
    this.bookingIntervals=[];
    setInterval(() => {
      this.bookingIntervals.map(b=>{
        clearInterval(b)
      })
    }, 1000);
    let state = {
      isWatchingAvailability: false,
      vaccineType: 'ANY',
      bookingInProgress: false,
      isAuthenticated: localStorage.token ? true : false,
      minAge: 18,
      districtId: null,
      stateId: null,
      beneficiaries: [],
      selectedBeneficiaries: [],
      otpData: {
        txnId: null
      },
      vaccineCalendar: {},
      zip: null,
      enableOtp: false,
      otp: null,
      mobile: null,
      feeType: 'Any',
      token: localStorage.token || null,
      selectedTab: "1",
      dates: [],
      states: [],
      dose: 1,
      districs: [],
      session: null,
      showCaptcha: false, //change to false
      captcha: null, //change to null
      bookingCaptcha: null,
      bookingCenter: null,
      showSuccessModal: false
    };
    if(localStorage.appData){
      state = Object.assign(state, JSON.parse(localStorage.appData))
    } 
    if(localStorage.token){
      state.token = localStorage.token;
      state.isAuthenticated = true;
      state.enableOtp = false;
    }
    this.state = state;
  }
  async waitForOtp(){

    console.log('waiting for otp');
    if(this.ac){
      this.ac.abort();
    }
    if ('OTPCredential' in window) {
      
      console.log('Waiting for SMS. Try sending yourself a following message:\n\n' +
          'Your verification code is: 123ABC\n\n' +
          '@whatwebcando.today #123ABC');

          try {
            this.ac = new AbortController();
            const theotp = await navigator.credentials.get({
              otp: { transport:['sms'] },
              signal: this.ac.signal
            }).then(otp => {
              console.log('otp is ', otp);
              console.log(`otp, ${otp}`);
              this.setState({otp});
            }).catch(err => {
              console.log(`ssss ${err}`);
            });  
            console.log(theotp);
          } catch (error) {
            console.log(error);
          }
          
    } else {
      console.log('Web OTP API not supported');
    }
      
  }
  getBeneficiaries(){
    // console.log('get bens');
    cowinApi.getBenefeciaries(this.state.token).then(data=>{
      this.setState({beneficiaries: data},()=>{this.setStorage()});
    }).catch(err=>{
      console.log(err);
      delete localStorage.token;
      this.setState({isAuthenticated: false, token: null, enableOtp: false},()=>{
        if(this.state.mobile){
          // this.generateOtp()
        }
      })
    })
  }
  speak(msg){
    
      let speech = new SpeechSynthesisUtterance();

      speech.lang = "en-UK";
      speech.volume = 1;
      speech.rate = 1;
      speech.pitch = 1; 
      speech.text = msg;
      window.speechSynthesis.speak(speech);  
    

  }
  componentDidMount(){
    this.notifSound = document.getElementById("notif");
    let token = localStorage.token || this.state.token;
    if(token){
      this.getBeneficiaries();
      this.trackAuth(token);
    }

    cowinApi.getStates().then(data=>{
      this.setState({states: data.states},()=>{
        this.selectState(this.state.stateId);
        this.selectDistrict(this.state.districtId);
      })
    }).catch(err=>{
      console.log(err);
    })
    
    // const self = this;  
    try {
      Notification.requestPermission((status) => {
        console.log("Notification permission status:", status);
      });  
    } catch (error) {
      console.log(error);
    }  
    

    


    try {
      // this.notifSound.play();  
    } catch (error) {
      console.log(error)
    }
      let opts = {
        title: "Vaccine Notifications Enabled",
        body: `You now have notifications active for Covid vaccine availability`,
        native: true,
        vibrate: [300, 100, 400]
      };
      try {
        Notification.requestPermission(function(result) {
          if (result === 'granted') {
            navigator.serviceWorker.ready.then(function(registration) {
              registration.showNotification(opts.title, opts);
            });
          }
        });
        new Notification(opts.title, opts);  
      } catch (error) {
        console.log(error);
      }
  }
  setStorage(){
    let state = Object.assign({}, this.state)
    delete state.enableOtp;
    delete state.vaccineCalendar;
    delete state.isWatchingAvailability;
    localStorage.appData = JSON.stringify(state);
  }
  componentWillUnmount() {
    // unsubscribe to ensure no memory leaks
    this.setStorage();
    if(this.watcher) this.watcher.unsubscribe();
  }
  handleNotification(){
    let centers = this.state.vaccineCalendar.centers;
    let requiredNums = 1;
    if(this.state.selectedBeneficiaries && Array.isArray(this.state.selectedBeneficiaries) && this.state.selectedBeneficiaries.length>0){
      requiredNums = this.state.selectedBeneficiaries.length;
    }
    let bkgInProgress = false;
    centers.map(c=>{
      c.sessions.map(s=>{
        
        if (
          parseInt(s.min_age_limit) === this.state.minAge &&
          parseInt(s.available_capacity) >= requiredNums && 
          !this.state.bookingInProgress
        ) {

          let vt = this.state.vaccineType;
          if(vt !== 'ANY' && vt!== s.vaccine){
            return;
          }

          if(this.state.feeType && this.state.feeType !== "Any" && this.state.feeType !== c.fee_type){
            return;
          }
          
          try {
            // this.notifSound.play();  
          } catch (error) {
            
          }

          let opts = {
            title: c.name,
            body: `${c.pincode} ${c.address} has ${s.available_capacity} on ${s.date}`,
            vibrate: [300, 100, 400],
            native: true
          }
          try {
            Notification.requestPermission(function(result) {
              if (result === 'granted') {
                navigator.serviceWorker.ready.then(function(registration) {
                  registration.showNotification(opts.message, opts);
                });
              }
            });
            new Notification(opts.title, opts);    
            
            this.speak(`Vaccines available at ${c.name}`);
            if(this.state.isAuthenticated){
              this.setState({bookingInProgress: true, bookingCenter: c, bookingSession: s},()=>{
                if(!this.state.bookingCaptcha && !bkgInProgress){
                  this.getCaptcha();
                  bkgInProgress = true;
                  this.clearWatch();
                  // this.book(s, c);
                }
              })
            }else{
              // this.generateOtp();
            }
            
            
          } catch (error) {
            console.log(error);
          }
          
          
        }
      })
    })
  }
  bookingError = (msg, desc) => {
    notification.error({
      message: msg,
      description: desc
    });
  };
  getCaptcha(){
    this.setState({bookingInProgress: true}, ()=>{
      cowinApi.getCaptcha().then(data=>{
        this.speak('Enter captcha to verify and proceed booking')
        this.setState({captcha: data.captcha, showCaptcha: true},()=>{
        })
      }).catch(err=>{
        console.log('error getting captcha ',err)
        this.setState({bookingInProgress: false})
      })
    })
  }
  async book(captcha){
    console.log('book');
    let benIds = [];
    let session = this.state.bookingSession;
    if(this.state.selectedBeneficiaries.length === 0){
      if(!this.state.isAuthenticated){
        this.setState({enableOtp: true},()=>{
          this.generateOtp()
        })
      }
      return;
    }else{
      this.state.selectedBeneficiaries.map(sb=>{
        benIds.push(sb.beneficiary_reference_id)
      })
    }
    
    
    let payload = {
      dose: this.state.dose ? parseInt(this.state.dose) : 1,
      session_id: session.session_id,
      slot: session.slots[Math.floor(Math.random() * session.slots.length)],
      beneficiaries: benIds,
      captcha: this.state.bookingCaptcha
    }
    // let thisInterval = setInterval(()=>{
      cowinApi.book(payload, this.state.token).then(data=>{
        console.log('Booking success ', data.appointment_id);
        this.clearWatch();
        this.setState({bookingInProgress: false, appointment_id: JSON.stringify(data), showSuccessModal: true});
      }).catch(err=>{
        this.setState({
          bookingInProgress: false, 
          session: null, 
          bookingCenter: null, 
          captcha: null, 
          bookingSession: null, 
          bookingCaptcha: null, 
          showCaptcha: false
        });
        let msg = 'Booking did not get through. ';
        let desc = "The availability probably ran out before you could take an action. You can refresh if needed. Otherwise the app will continue to look for slots."
        this.bookingError(msg, desc);
        // this.speak(msg);
        console.log(msg);
      })  
    // }, 100)
    // if(!this.bookingIntervals){
    //   this.bookingIntervals = [];
    // }
    // this.bookingIntervals.push(thisInterval);
  }

  initWatch(zip) {
    const self = this;

    this.setStorage();
    this.setState({isWatchingAvailability: true});
    if(this.state.selectedTab === "1"){
      this.watcher = cowinApi
      .initDist(this.state.districtId, moment().format("DD-MM-YYYY"))
      .subscribe({
        next(data) {
          self.setState({vaccineCalendar: data},()=>{
            self.handleNotification();
            // self.setStorage()
          })
        },
        error(err) {
          console.error("something wrong occurred: " + err);
        },
        complete() {
          console.log("done");
          this.setState({ isWatchingAvailability: false });
        },
      });
    }else{
      this.watcher = cowinApi
      .init(this.state.zip, moment().format("DD-MM-YYYY"))
      .subscribe({
        next(data) {
          self.setState({vaccineCalendar: data},()=>{
            self.handleNotification();
            self.setStorage()
          })
        },
        error(err) {
          console.error("something wrong occurred: " + err);
        },
        complete() {
          console.log("done");
          this.setState({ isWatchingAvailability: false });
        },
      });
    }
    
  }
  trackAuth() {
    const self = this;
    console.log('trackauth');
    if(this.state.isAuthenticated===false) return;
    this.authWatch = cowinApi
      .trackAuth(this.state.token)
      .subscribe({
        next(data) {
          // console.log({sdata: data})
          if(Array.isArray(data)){
            self.setState({beneficiaries: data})
          }else{
            console.log('asasad');
            cowinApi.clearAuthWatch();
            delete localStorage.token;
            self.setState({isAuthenticated: false, token: null},()=>{
              
              if(self.state.isWatchingAvailability){
                self.generateOtp();
                self.speak('Session expired!');
              }
              
            })
          }
          
        },
        error(err) {
          console.error("something wrong occurred: " + err);
          self.speak('Session expired!');
          cowinApi.clearAuthWatch();
          delete localStorage.token;
          self.setState({isAuthenticated: false, token: null},()=>{
            if(self.state.isWatchingAvailability && !self.state.enableOtp){
              self.generateOtp();
              
              self.speak('Session expired!');
            }
          })
        },
        complete() {
          console.log("done");
          self.setState({ isWatchingAvailability: false });
        },
      });
  }
  clearWatch() {
    cowinApi.clearWatch();
    this.setState({ isWatchingAvailability: false });
  }
  renderTable(vaccineCalendar){
    return (
      <div>
        <h2 style={{ marginTop: 10 }}>Vaccination Centers & Availability Info</h2>
        <Text type="secondary">You will see all kinds of availability below. But, the notifications and bookings will be done for your selected preferences only.</Text>
        <table style={{ marginTop: 10 }}>
          {vaccineCalendar.centers.map((vc) => {
            let noAvailability = true;
            vc.sessions.map((ss) => {
              // eslint-disable-next-line no-unused-vars
              if (ss.available_capacity > 0) noAvailability = false;
            });

            return (
              <tr key={vc.center_id}>
                <td>
                  <h3>{vc.name}</h3>
                  <b>Fee: {vc.fee_type}</b><br/>
                  {vc.block_name}, {vc.address}, {vc.pincode}.
                </td>

                {false ? (
                  <td>No Availability</td>
                ) : (
                  vc.sessions.map((s) => {

                    return (
                      <td key={s.session_id}>
                        <h4>{s.date}</h4>
                        <p>{s.vaccine}</p>
                        <div>
                          {parseInt(s.available_capacity) > 0
                            ? `${s.available_capacity} shots available for ${s.min_age_limit}+`
                            : `No Availability ${s.min_age_limit}`}
                        </div>
                        {parseInt(s.available_capacity > 0) ? (
                          <div>
                            <b>Available Slots</b>
                            {s.slots.map((sl) => {
                              return <Row>{sl}</Row>;
                            })}
                          </div>
                        ) : null}
                      </td>
                    );
                  })
                )}

                {/* </th> */}
              </tr>
            );
          })}
        </table>
      </div>
    );
      
  }
  setMinAge(e){
    this.setState({minAge: e.target.value});
  }
  generateOtp(){
    
    this.setState({enableOtp: true}, ()=>{
      cowinApi.generateOtp(this.state.mobile).then(data=>{
        // console.log(data);
        this.speak("One Time Password has been sent to your phone. Please enter.");
        // this.notifSound.play();  
        this.setState({otpData: data, enableOtp: true});
        // this.waitForOtp();
      }).catch(err=>{
        console.log(err);
        this.setState({enableOtp: false})
      })
    });
    
  }
  verifyOtp(){
    cowinApi.verifyOtp(this.state.otp, this.state.otpData.txnId).then(data=>{
      // console.log('otp verify ', data);
      localStorage.token = data.token;
      this.setState({token: data.token, isAuthenticated: true, enableOtp: false}, ()=>{
        this.setStorage();
        this.getBeneficiaries();
        this.trackAuth(data.token);
      })
    }).catch(err=>{
      console.log(err);
      if(this.state.isAuthenticated){
        delete localStorage.appData;
        delete localStorage.token;
        this.setState({token: null, isAuthenticated: false});
      }
    })
  }
  selectState(stateId){
    this.setState({stateId}, ()=>{
      cowinApi.getDistricts(stateId).then(data=>{
        this.setState({districs: data});
      }).catch(err=>{
        console.log(err)
      })
    })
  }
  selectDistrict(districtId){
    this.setState({districtId}, ()=>{
    })
  }
  renderCaptcha(){
    return (
      <div>
        <h2 style={{ marginTop: 10, marginBottom: 0 }}>Enter Captcha</h2>
        <Row>
          <Col>{parseHTML(this.state.captcha)}</Col>
          <Search
            placeholder="Enter Captcha"
            allowClear
            style={{width: 300, marginTop: 10}}
            // value={this.state.zip}
            enterButton={"Submit & Book"}
            size="large"
            onSearch={(e) => {
              console.log(e);
              this.setState({ bookingCaptcha: e }, () => {
                this.book();
              });
            }}
          />
          
        </Row>
      </div>
    );
  }
  renderModal(){
    if(!this.state.bookingSession || !this.state.bookingCenter){
      return;
    }
    return <Modal
        mask={true}
        maskClosable={false}
        title="Congrats!"
        visible={this.state.showSuccessModal}
        onOk={(e) => {
          window.location='https://selfregistration.cowin.gov.in/dashboard'
        }}
        onCancel={(e) => {
          this.setState({
            bookingInProgress: false, 
            showSuccessModal: false, 
            bookingCenter: null, 
            bookingSession: null, 
            captcha: null, 
            bookingCaptcha: null,
            showCaptcha: false
          });
        }}
      >
        <p>
          Your vaccination slot is booked for selected beneficiaries at{" "}
          {this.state.bookingCenter.name}, {this.state.bookingCenter.block_name}
          , {this.state.bookingCenter.address},{" "}
          {this.state.bookingCenter.district_name},{" "}
          {this.state.bookingCenter.state_name},{" "}
          {this.state.bookingCenter.pincode}
        </p>
        <p>Your appointment id is {this.state.appointment_id}</p>
        <p>
          You can login into{" "}
          <a
            href="https://www.cowin.gov.in/home"
            target="_blank"
            rel="noreferrer"
          >
            Cowin
          </a>{" "}
          to see details of your vaccincation slot.
        </p>
      </Modal>;
    
  }
  render() {
    const vaccineCalendar = this.state.vaccineCalendar;
    const isAuthenticated = this.state.isAuthenticated;
    const {beneficiaries, selectedBeneficiaries} = this.state;
    return (
      <div className="App">
        {/* <Notifications /> */}
        <audio id="notif">
          <source src="https://assets.coderrocketfuel.com/pomodoro-times-up.mp3"></source>
        </audio>
        <header className="App-header">
          <h1>
            India Only - Covid-19 automatic vaccine bookings and notifications for
            availability.
          </h1>
          <p>
            This web-app can continously track for availability of vaccine and
            proceed with booking on your behalf if you are logged in. <br />
            <b>The app does not store any of your personal information on a remote server. All the data remains within your browser. Please see the Privacy Policy at the bottom of the page for any concerns.</b>
          </p>
          <p style={{ color: "#555" }}>
            Please register on{" "}
            <a
              href="https://www.cowin.gov.in/home"
              target="_blank"
              rel="noreferrer"
            >
              Cowin
            </a>
            {", "}
            add beneficiaries and then, come back here for automated bookings.
            <br />
            For automatic bookings, login, select beneficiaries, keep feeding in
            OTPs every few mins. When there's availability, the app will
            automatically attempt for a booking based on your preferences. When
            there's availability, you will have to enter captcha code. The app
            will speak out for any inputs(OTP and Captcha) required. For more
            information, please see the{" "}
            <a
              href="http://cowinbook.netlify.app"
              target="_blank"
              rel="noreferrer"
            >
              Help/Usage Guide
            </a>
            <br />
            <br />
            *Please be careful with the location selection as the booking can
            automatically happen at any center that has availability within your
            selected region.
            <br />
            *If you are on mobile, make sure that you keep the tab active and the auto screenlock is off.Tracking will be automatically paused unless your device has a way to keeping the app from pausing when it goes to background.
            <br />
            **There are limited number of slots opening up and it is running out
            almost instantly. Please keep feeding in OTPs when the session
            expires to input the captcha available to book as soon as there's
            availability. It takes time, it took me 2 days to get a slot.
            <br />
            <b>
              This app now{" "}
              <a
                href="http://cowinbook.netlify.app"
                target="_blank"
                rel="noreferrer"
              >
                supports captcha/security code.
              </a>
            </b>
          </p>
        </header>

        {/* <Col style={{ marginBottom: 10 }}>
          {this.state.isWatchingAvailability ? null : (
            <title>Select age group for getting notifications</title>
          )}
        </Col> */}
        <Row>
          <Col>
            {isAuthenticated ? null : (
              <div>
                <h2>Login</h2>
                {this.state.enableOtp ? null : (
                  <Search
                    placeholder={
                      this.state.mobile ? this.state.mobile : "Mobile Number"
                    }
                    allowClear
                    defaultValue={this.state.mobile || null}
                    type="number"
                    // value={this.state.mobile}
                    enterButton={"Generate OTP"}
                    size="large"
                    onSearch={(e) => {
                      this.setState(
                        {
                          mobile: e === "" ? this.state.mobile : e,
                          enableOtp: true,
                        },
                        () => {
                          this.generateOtp();
                        }
                      );
                    }}
                  />
                )}
                {this.state.enableOtp ? (
                  <span>
                    <Search
                      placeholder="Enter OTP"
                      allowClear
                      type="number"
                      // value={this.state.zip}
                      enterButton={"Submit"}
                      size="large"
                      onSearch={(e) => {
                        this.setState({ otp: e }, () => {
                          this.verifyOtp();
                        });
                      }}
                    />
                    <Button
                      danger
                      onClick={(e) => {
                        this.setState({ enableOtp: false });
                      }}
                      type="link"
                    >
                      Cancel
                    </Button>
                  </span>
                ) : null}
              </div>
            )}

            {isAuthenticated ? (
              <div>
                <h2>Beneficiaries</h2>
                {beneficiaries.length === 0 ? (
                  <p>
                    You do not have any benificiares added yet. Please login to{" "}
                    <a
                      href="https://www.cowin.gov.in/home"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Cowin
                    </a>{" "}
                    and add beneficiaries
                  </p>
                ) : (
                  <p>
                    Select beneficiaries to book a slot automatically when
                    there's availability. This app can continuously track
                    availability and make a booking.
                  </p>
                )}
                {this.state.beneficiaries.map((b) => {
                  return (
                    <Row>
                      <Checkbox
                        disabled={this.state.isWatchingAvailability}
                        checked={
                          selectedBeneficiaries.findIndex((sb) => {
                            return (
                              sb.beneficiary_reference_id ===
                              b.beneficiary_reference_id
                            );
                          }) !== -1
                        }
                        onClick={(e) => {
                          let sbs = this.state.selectedBeneficiaries;
                          let idx = sbs.findIndex((sb) => {
                            return (
                              sb.beneficiary_reference_id ===
                              b.beneficiary_reference_id
                            );
                          });
                          if (idx === -1) {
                            sbs.push(b);
                          } else {
                            sbs.splice(idx, 1);
                          }
                          this.setState({ selectedBeneficiaries: sbs });
                        }}
                      >
                        {b.name}
                      </Checkbox>
                    </Row>
                  );
                })}
              </div>
            ) : null}
            <h2 style={{ marginTop: 14, marginBottom: 0 }}>
              Booking Preferences
            </h2>
            <Row style={{ marginTop: 10 }}>
              <h3 style={{ marginTop: 10, marginBottom: 0 }}>Vaccine Type</h3>
              <Radio.Group
                style={{ marginTop: 12, marginLeft: 10 }}
                onChange={(e) => {
                  this.setState({ vaccineType: e.target.value });
                }}
                value={this.state.vaccineType}
                disabled={this.state.isWatchingAvailability}
              >
                <Radio value={"ANY"}>Any</Radio>
                <Radio value={"COVAXIN"}>Covaxin</Radio>
                <Radio value={"COVISHIELD"}>Covishield</Radio>
              </Radio.Group>
            </Row>

            <Row style={{ marginTop: 10 }}>
              <h3 style={{ marginTop: 10, marginBottom: 0 }}>Age Group</h3>
              <Radio.Group
                style={{ marginTop: 12, marginLeft: 10 }}
                onChange={this.setMinAge.bind(this)}
                value={this.state.minAge}
                disabled={this.state.isWatchingAvailability}
              >
                <Radio value={18}>18 to 45 Years</Radio>
                <Radio value={45}>45+ Years</Radio>
              </Radio.Group>
            </Row>

            <Row style={{ marginTop: 10 }}>
              <h3 style={{ marginTop: 10, marginBottom: 0 }}>Fee Type</h3>
              <Radio.Group
                style={{ marginTop: 12, marginLeft: 10 }}
                onChange={(e) => {
                  this.setState({ feeType: e.target.value });
                }}
                value={this.state.feeType}
                disabled={this.state.isWatchingAvailability}
              >
                <Radio value={"Any"}>Any</Radio>
                <Radio value={"Free"}>Free</Radio>
                <Radio value={"Paid"}>Paid</Radio>
              </Radio.Group>
            </Row>

            <Row style={{ marginTop: 5 }}>
              <h3 style={{ marginTop: 10, marginBottom: 0 }}>Dose</h3>
              <Radio.Group
                style={{ marginTop: 12, marginLeft: 10 }}
                onChange={(e) => {
                  this.setState({ dose: e.target.value });
                }}
                defaultValue={1}
                value={this.state.dose}
                disabled={this.state.isWatchingAvailability}
              >
                <Radio value={1}>Dose 1</Radio>
                <Radio value={2}>Dose 2</Radio>
              </Radio.Group>
            </Row>

            <h2 style={{ marginTop: 15, marginBottom: 0 }}>
              Select Location for Tracking Availability
            </h2>
            <Tabs
              defaultActiveKey={this.state.selectedTab || "1"}
              onChange={(e) => {
                this.setState({ selectedTab: e });
              }}
            >
              <TabPane tab="Track By District" key={1}>
                <Select
                  style={{ width: 234 }}
                  size="large"
                  defaultValue={this.state.stateId}
                  onChange={this.selectState.bind(this)}
                  placeholder="Select State"
                >
                  {this.state.states.map((s) => {
                    return (
                      <Option key={s.state_id} value={s.state_id}>
                        {s.state_name}
                      </Option>
                    );
                  })}
                </Select>

                <Select
                  style={{ width: 234 }}
                  defaultValue={this.state.districtId}
                  size="large"
                  onChange={(val) => {
                    this.selectDistrict(val);
                  }}
                  placeholder="Select District"
                >
                  {this.state.districs.map((d) => {
                    return (
                      <Option key={d.district_id} value={d.district_id}>
                        {d.district_name}
                      </Option>
                    );
                  })}
                </Select>
                <Button
                  type="primary"
                  size="large"
                  loading={this.state.isWatchingAvailability}
                  onClick={(e) => this.initWatch()}
                >
                  {this.state.isWatchingAvailability
                    ? "Tracking"
                    : this.state.isAuthenticated
                    ? "Track Availability & Book"
                    : "Track Availability"}
                </Button>
                {this.state.isWatchingAvailability ? (
                  <Button
                    type="primary"
                    icon={<CloseCircleOutlined />}
                    size={"large"}
                    danger
                    onClick={this.clearWatch.bind(this)}
                  >
                    Stop
                  </Button>
                ) : null}
              </TabPane>
              <TabPane tab="Track By Pincode" key={2}>
                <Row>
                  <Search
                    disabled={this.state.isWatchingAvailability}
                    placeholder={
                      this.state.zip
                        ? this.state.zip
                        : "Enter your area pincode"
                    }
                    allowClear
                    defaultValue={this.state.zip || null}
                    type="number"
                    // value={this.state.zip}
                    enterButton={
                      this.state.isWatchingAvailability
                        ? `Tracking`
                        : this.state.isAuthenticated
                        ? "Track Availability & Book"
                        : "Track Availability"
                    }
                    size="large"
                    loading={this.state.isWatchingAvailability}
                    onSearch={(txt) => {
                      this.setState(
                        { zip: txt, isWatchingAvailability: true },
                        () => {
                          this.initWatch();
                        }
                      );
                    }}
                  />
                  {this.state.isWatchingAvailability ? (
                    <Button
                      type="primary"
                      icon={<CloseCircleOutlined />}
                      size={"large"}
                      danger
                      onClick={this.clearWatch.bind(this)}
                    >
                      Stop
                    </Button>
                  ) : null}
                </Row>
              </TabPane>
            </Tabs>

            {/* <Col>
              {this.state.isWatchingAvailability ? (
                <Button
                  type="primary"
                  icon={<CloseCircleOutlined />}
                  size={"large"}
                  danger
                  onClick={this.clearWatch.bind(this)}
                >
                  Stop
                </Button>
              ) : null}
            </Col> */}
          </Col>
        </Row>

        {this.state.showCaptcha ? this.renderCaptcha() : null}
        {vaccineCalendar && vaccineCalendar.centers
          ? this.renderTable(vaccineCalendar)
          : null}

        <h3 style={{ marginTop: 15, marginBottom: 0 }}>Donate</h3>
        <img style={{width: 300}} src={PayTMQR} alt="PayTM QR Code"/>
        {/* <div>
          <a
            className="paytm-button"
            href="https://paytm.me/yV-4JXd"
            rel="noreferrer"
            target="_blank"
          >
            Donate with PayTM
          </a>
        </div> */}
        <div>
          <a
            className="paypal-button"
            href="https://paypal.me/YashwanthMaheshwaram?locale.x=en_GB"
            rel="noreferrer"
            target="_blank"
          >
            <img
              className="paypal-button-logo paypal-button-logo-pp paypal-button-logo-gold"
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAyNCAzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBwcmVzZXJ2ZUFzcGVjdFJhdGlvPSJ4TWluWU1pbiBtZWV0Ij4KICAgIDxwYXRoIGZpbGw9IiMwMDljZGUiIGQ9Ik0gMjAuOTA1IDkuNSBDIDIxLjE4NSA3LjQgMjAuOTA1IDYgMTkuNzgyIDQuNyBDIDE4LjU2NCAzLjMgMTYuNDExIDIuNiAxMy42OTcgMi42IEwgNS43MzkgMi42IEMgNS4yNzEgMi42IDQuNzEgMy4xIDQuNjE1IDMuNiBMIDEuMzM5IDI1LjggQyAxLjMzOSAyNi4yIDEuNjIgMjYuNyAyLjA4OCAyNi43IEwgNi45NTYgMjYuNyBMIDYuNjc1IDI4LjkgQyA2LjU4MSAyOS4zIDYuODYyIDI5LjYgNy4yMzYgMjkuNiBMIDExLjM1NiAyOS42IEMgMTEuODI1IDI5LjYgMTIuMjkyIDI5LjMgMTIuMzg2IDI4LjggTCAxMi4zODYgMjguNSBMIDEzLjIyOCAyMy4zIEwgMTMuMjI4IDIzLjEgQyAxMy4zMjIgMjIuNiAxMy43OSAyMi4yIDE0LjI1OCAyMi4yIEwgMTQuODIxIDIyLjIgQyAxOC44NDUgMjIuMiAyMS45MzUgMjAuNSAyMi44NzEgMTUuNSBDIDIzLjMzOSAxMy40IDIzLjE1MyAxMS43IDIyLjAyOSAxMC41IEMgMjEuNzQ4IDEwLjEgMjEuMjc5IDkuOCAyMC45MDUgOS41IEwgMjAuOTA1IDkuNSI+PC9wYXRoPgogICAgPHBhdGggZmlsbD0iIzAxMjE2OSIgZD0iTSAyMC45MDUgOS41IEMgMjEuMTg1IDcuNCAyMC45MDUgNiAxOS43ODIgNC43IEMgMTguNTY0IDMuMyAxNi40MTEgMi42IDEzLjY5NyAyLjYgTCA1LjczOSAyLjYgQyA1LjI3MSAyLjYgNC43MSAzLjEgNC42MTUgMy42IEwgMS4zMzkgMjUuOCBDIDEuMzM5IDI2LjIgMS42MiAyNi43IDIuMDg4IDI2LjcgTCA2Ljk1NiAyNi43IEwgOC4yNjcgMTguNCBMIDguMTczIDE4LjcgQyA4LjI2NyAxOC4xIDguNzM1IDE3LjcgOS4yOTYgMTcuNyBMIDExLjYzNiAxNy43IEMgMTYuMjI0IDE3LjcgMTkuNzgyIDE1LjcgMjAuOTA1IDEwLjEgQyAyMC44MTIgOS44IDIwLjkwNSA5LjcgMjAuOTA1IDkuNSI+PC9wYXRoPgogICAgPHBhdGggZmlsbD0iIzAwMzA4NyIgZD0iTSA5LjQ4NSA5LjUgQyA5LjU3NyA5LjIgOS43NjUgOC45IDEwLjA0NiA4LjcgQyAxMC4yMzIgOC43IDEwLjMyNiA4LjYgMTAuNTEzIDguNiBMIDE2LjY5MiA4LjYgQyAxNy40NDIgOC42IDE4LjE4OSA4LjcgMTguNzUzIDguOCBDIDE4LjkzOSA4LjggMTkuMTI3IDguOCAxOS4zMTQgOC45IEMgMTkuNTAxIDkgMTkuNjg4IDkgMTkuNzgyIDkuMSBDIDE5Ljg3NSA5LjEgMTkuOTY4IDkuMSAyMC4wNjMgOS4xIEMgMjAuMzQzIDkuMiAyMC42MjQgOS40IDIwLjkwNSA5LjUgQyAyMS4xODUgNy40IDIwLjkwNSA2IDE5Ljc4MiA0LjYgQyAxOC42NTggMy4yIDE2LjUwNiAyLjYgMTMuNzkgMi42IEwgNS43MzkgMi42IEMgNS4yNzEgMi42IDQuNzEgMyA0LjYxNSAzLjYgTCAxLjMzOSAyNS44IEMgMS4zMzkgMjYuMiAxLjYyIDI2LjcgMi4wODggMjYuNyBMIDYuOTU2IDI2LjcgTCA4LjI2NyAxOC40IEwgOS40ODUgOS41IFoiPjwvcGF0aD4KPC9zdmc+Cg"
              alt="donate with paypal"
              aria-label="pp"
            ></img>
            <img
              className="paypal-button-logo paypal-button-logo-paypal paypal-button-logo-gold"
              src="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjMyIiB2aWV3Qm94PSIwIDAgMTAwIDMyIiB4bWxucz0iaHR0cDomI3gyRjsmI3gyRjt3d3cudzMub3JnJiN4MkY7MjAwMCYjeDJGO3N2ZyIgcHJlc2VydmVBc3BlY3RSYXRpbz0ieE1pbllNaW4gbWVldCI+PHBhdGggZmlsbD0iIzAwMzA4NyIgZD0iTSAxMiA0LjkxNyBMIDQuMiA0LjkxNyBDIDMuNyA0LjkxNyAzLjIgNS4zMTcgMy4xIDUuODE3IEwgMCAyNS44MTcgQyAtMC4xIDI2LjIxNyAwLjIgMjYuNTE3IDAuNiAyNi41MTcgTCA0LjMgMjYuNTE3IEMgNC44IDI2LjUxNyA1LjMgMjYuMTE3IDUuNCAyNS42MTcgTCA2LjIgMjAuMjE3IEMgNi4zIDE5LjcxNyA2LjcgMTkuMzE3IDcuMyAxOS4zMTcgTCA5LjggMTkuMzE3IEMgMTQuOSAxOS4zMTcgMTcuOSAxNi44MTcgMTguNyAxMS45MTcgQyAxOSA5LjgxNyAxOC43IDguMTE3IDE3LjcgNi45MTcgQyAxNi42IDUuNjE3IDE0LjYgNC45MTcgMTIgNC45MTcgWiBNIDEyLjkgMTIuMjE3IEMgMTIuNSAxNS4wMTcgMTAuMyAxNS4wMTcgOC4zIDE1LjAxNyBMIDcuMSAxNS4wMTcgTCA3LjkgOS44MTcgQyA3LjkgOS41MTcgOC4yIDkuMzE3IDguNSA5LjMxNyBMIDkgOS4zMTcgQyAxMC40IDkuMzE3IDExLjcgOS4zMTcgMTIuNCAxMC4xMTcgQyAxMi45IDEwLjUxNyAxMy4xIDExLjIxNyAxMi45IDEyLjIxNyBaIj48L3BhdGg+PHBhdGggZmlsbD0iIzAwMzA4NyIgZD0iTSAzNS4yIDEyLjExNyBMIDMxLjUgMTIuMTE3IEMgMzEuMiAxMi4xMTcgMzAuOSAxMi4zMTcgMzAuOSAxMi42MTcgTCAzMC43IDEzLjYxNyBMIDMwLjQgMTMuMjE3IEMgMjkuNiAxMi4wMTcgMjcuOCAxMS42MTcgMjYgMTEuNjE3IEMgMjEuOSAxMS42MTcgMTguNCAxNC43MTcgMTcuNyAxOS4xMTcgQyAxNy4zIDIxLjMxNyAxNy44IDIzLjQxNyAxOS4xIDI0LjgxNyBDIDIwLjIgMjYuMTE3IDIxLjkgMjYuNzE3IDIzLjggMjYuNzE3IEMgMjcuMSAyNi43MTcgMjkgMjQuNjE3IDI5IDI0LjYxNyBMIDI4LjggMjUuNjE3IEMgMjguNyAyNi4wMTcgMjkgMjYuNDE3IDI5LjQgMjYuNDE3IEwgMzIuOCAyNi40MTcgQyAzMy4zIDI2LjQxNyAzMy44IDI2LjAxNyAzMy45IDI1LjUxNyBMIDM1LjkgMTIuNzE3IEMgMzYgMTIuNTE3IDM1LjYgMTIuMTE3IDM1LjIgMTIuMTE3IFogTSAzMC4xIDE5LjMxNyBDIDI5LjcgMjEuNDE3IDI4LjEgMjIuOTE3IDI1LjkgMjIuOTE3IEMgMjQuOCAyMi45MTcgMjQgMjIuNjE3IDIzLjQgMjEuOTE3IEMgMjIuOCAyMS4yMTcgMjIuNiAyMC4zMTcgMjIuOCAxOS4zMTcgQyAyMy4xIDE3LjIxNyAyNC45IDE1LjcxNyAyNyAxNS43MTcgQyAyOC4xIDE1LjcxNyAyOC45IDE2LjExNyAyOS41IDE2LjcxNyBDIDMwIDE3LjQxNyAzMC4yIDE4LjMxNyAzMC4xIDE5LjMxNyBaIj48L3BhdGg+PHBhdGggZmlsbD0iIzAwMzA4NyIgZD0iTSA1NS4xIDEyLjExNyBMIDUxLjQgMTIuMTE3IEMgNTEgMTIuMTE3IDUwLjcgMTIuMzE3IDUwLjUgMTIuNjE3IEwgNDUuMyAyMC4yMTcgTCA0My4xIDEyLjkxNyBDIDQzIDEyLjQxNyA0Mi41IDEyLjExNyA0Mi4xIDEyLjExNyBMIDM4LjQgMTIuMTE3IEMgMzggMTIuMTE3IDM3LjYgMTIuNTE3IDM3LjggMTMuMDE3IEwgNDEuOSAyNS4xMTcgTCAzOCAzMC41MTcgQyAzNy43IDMwLjkxNyAzOCAzMS41MTcgMzguNSAzMS41MTcgTCA0Mi4yIDMxLjUxNyBDIDQyLjYgMzEuNTE3IDQyLjkgMzEuMzE3IDQzLjEgMzEuMDE3IEwgNTUuNiAxMy4wMTcgQyA1NS45IDEyLjcxNyA1NS42IDEyLjExNyA1NS4xIDEyLjExNyBaIj48L3BhdGg+PHBhdGggZmlsbD0iIzAwOWNkZSIgZD0iTSA2Ny41IDQuOTE3IEwgNTkuNyA0LjkxNyBDIDU5LjIgNC45MTcgNTguNyA1LjMxNyA1OC42IDUuODE3IEwgNTUuNSAyNS43MTcgQyA1NS40IDI2LjExNyA1NS43IDI2LjQxNyA1Ni4xIDI2LjQxNyBMIDYwLjEgMjYuNDE3IEMgNjAuNSAyNi40MTcgNjAuOCAyNi4xMTcgNjAuOCAyNS44MTcgTCA2MS43IDIwLjExNyBDIDYxLjggMTkuNjE3IDYyLjIgMTkuMjE3IDYyLjggMTkuMjE3IEwgNjUuMyAxOS4yMTcgQyA3MC40IDE5LjIxNyA3My40IDE2LjcxNyA3NC4yIDExLjgxNyBDIDc0LjUgOS43MTcgNzQuMiA4LjAxNyA3My4yIDYuODE3IEMgNzIgNS42MTcgNzAuMSA0LjkxNyA2Ny41IDQuOTE3IFogTSA2OC40IDEyLjIxNyBDIDY4IDE1LjAxNyA2NS44IDE1LjAxNyA2My44IDE1LjAxNyBMIDYyLjYgMTUuMDE3IEwgNjMuNCA5LjgxNyBDIDYzLjQgOS41MTcgNjMuNyA5LjMxNyA2NCA5LjMxNyBMIDY0LjUgOS4zMTcgQyA2NS45IDkuMzE3IDY3LjIgOS4zMTcgNjcuOSAxMC4xMTcgQyA2OC40IDEwLjUxNyA2OC41IDExLjIxNyA2OC40IDEyLjIxNyBaIj48L3BhdGg+PHBhdGggZmlsbD0iIzAwOWNkZSIgZD0iTSA5MC43IDEyLjExNyBMIDg3IDEyLjExNyBDIDg2LjcgMTIuMTE3IDg2LjQgMTIuMzE3IDg2LjQgMTIuNjE3IEwgODYuMiAxMy42MTcgTCA4NS45IDEzLjIxNyBDIDg1LjEgMTIuMDE3IDgzLjMgMTEuNjE3IDgxLjUgMTEuNjE3IEMgNzcuNCAxMS42MTcgNzMuOSAxNC43MTcgNzMuMiAxOS4xMTcgQyA3Mi44IDIxLjMxNyA3My4zIDIzLjQxNyA3NC42IDI0LjgxNyBDIDc1LjcgMjYuMTE3IDc3LjQgMjYuNzE3IDc5LjMgMjYuNzE3IEMgODIuNiAyNi43MTcgODQuNSAyNC42MTcgODQuNSAyNC42MTcgTCA4NC4zIDI1LjYxNyBDIDg0LjIgMjYuMDE3IDg0LjUgMjYuNDE3IDg0LjkgMjYuNDE3IEwgODguMyAyNi40MTcgQyA4OC44IDI2LjQxNyA4OS4zIDI2LjAxNyA4OS40IDI1LjUxNyBMIDkxLjQgMTIuNzE3IEMgOTEuNCAxMi41MTcgOTEuMSAxMi4xMTcgOTAuNyAxMi4xMTcgWiBNIDg1LjUgMTkuMzE3IEMgODUuMSAyMS40MTcgODMuNSAyMi45MTcgODEuMyAyMi45MTcgQyA4MC4yIDIyLjkxNyA3OS40IDIyLjYxNyA3OC44IDIxLjkxNyBDIDc4LjIgMjEuMjE3IDc4IDIwLjMxNyA3OC4yIDE5LjMxNyBDIDc4LjUgMTcuMjE3IDgwLjMgMTUuNzE3IDgyLjQgMTUuNzE3IEMgODMuNSAxNS43MTcgODQuMyAxNi4xMTcgODQuOSAxNi43MTcgQyA4NS41IDE3LjQxNyA4NS43IDE4LjMxNyA4NS41IDE5LjMxNyBaIj48L3BhdGg+PHBhdGggZmlsbD0iIzAwOWNkZSIgZD0iTSA5NS4xIDUuNDE3IEwgOTEuOSAyNS43MTcgQyA5MS44IDI2LjExNyA5Mi4xIDI2LjQxNyA5Mi41IDI2LjQxNyBMIDk1LjcgMjYuNDE3IEMgOTYuMiAyNi40MTcgOTYuNyAyNi4wMTcgOTYuOCAyNS41MTcgTCAxMDAgNS42MTcgQyAxMDAuMSA1LjIxNyA5OS44IDQuOTE3IDk5LjQgNC45MTcgTCA5NS44IDQuOTE3IEMgOTUuNCA0LjkxNyA5NS4yIDUuMTE3IDk1LjEgNS40MTcgWiI+PC9wYXRoPjwvc3ZnPg"
              alt="Donate with paypal"
              aria-label="paypal"
            ></img>{" "}
            Donate
          </a>

          <p style={{ marginTop: 10, marginBottom: 0, fontWeight: "bold" }}>
            Crypto Wallet
          </p>
          <img style={{ width: 100 }} src={walletImage} alt="crypto-wallet" />
        </div>

        <h3 style={{ marginTop: 15, marginBottom: 0 }}>Share</h3>
        {/* <FacebookShareButton quote={promosg.text} hashtag={promosg.tags[0]}/> */}
        <FacebookShareButton
          url={promosg.url}
          quote={promosg.text}
          hashtag={promosg.tags[0]}
          className="Demo__some-network__share-button"
        >
          <FacebookIcon size={48} round />
        </FacebookShareButton>
        <TwitterShareButton
          url={promosg.url}
          title={promosg.title}
          className="Demo__some-network__share-button"
        >
          <TwitterIcon size={48} round />
        </TwitterShareButton>
        <WhatsappShareButton
          url={promosg.url}
          title={promosg.text}
          separator=":: "
          className="Demo__some-network__share-button"
        >
          <WhatsappIcon size={48} round />
        </WhatsappShareButton>
        <LinkedinShareButton
          url={promosg.url}
          summary={promosg.text}
          className="Demo__some-network__share-button"
        >
          <LinkedinIcon size={48} round />
        </LinkedinShareButton>
        <RedditShareButton
          url={promosg.url}
          title={promosg.text}
          windowWidth={660}
          windowHeight={460}
          className="Demo__some-network__share-button"
        >
          <RedditIcon size={48} round />
        </RedditShareButton>

        <TelegramShareButton
          url={promosg.url}
          title={promosg.text}
          className="Demo__some-network__share-button"
        >
          <TelegramIcon size={48} round />
        </TelegramShareButton>

        <div style={{ marginTop: 10 }}></div>
        <Text code>Build last updated at: {version}</Text>
        {this.renderModal()}

        <div>
          <Row>
            <Button
            type="link"
              href="https://github.com/yashwanthm/cowin-vaccine-booking/issues"
              rel="noreferrer"
              target="_blank"
            >
              Report an issue
            </Button>  <Button type="link"
              href="https://github.com/yashwanthm/cowin-vaccine-booking/"
              rel="noreferrer"
              target="_blank"
            >
              Git Repo is here
            </Button> 
            <Button type="link" onClick={e=>{this.setState({showPrivacyPolicy: true})}}>Privacy Policy</Button>
          </Row>
        </div>

        <Modal title="" okText="Close"  footer={[
            <Button key="back" onClick={e=>{this.setState({showPrivacyPolicy: false})}}>
              Okay
            </Button>]}  visible={this.state.showPrivacyPolicy} onOk={e=>{this.setState({showPrivacyPolicy: false})}}>
          {parseHTML(privacy)}
        </Modal>
      </div>
    );
  }
}
export default App;
