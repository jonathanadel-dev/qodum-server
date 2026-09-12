// Imports
import express from 'express';
import bcrypt from 'bcryptjs';
import AppStudent from '../models/AppStudent.js';
import signToken from '../utils/signToken/studentJwt.js';
import AdmittedStudent from '../models/AdmittedStudent.js';
import {validateAdmNo, validateApplyForAdmission, validateLoginInputs, validateRegisterInputs} from '../validations/auth.js';
import AcademicYear from '../models/AcademicYear.js';
import Student from '../models/Student.js';
import Admission from '../models/Admission.js';





// Defining router
const router = express.Router();





// The OTP
let otp;
let student;
let isOTPVerified = false;





// Mobile OTP
let mobile_otp;
let isMobileOTPVerified = false;





// Fetching student by adm no and sending OTP to the registered phone number
router.post('/student/send-otp', async (req, res) => {
    try {

        // Admission number
        const {adm_no} = req.body;


        // Admission number validation and fetching student
        if(!adm_no) {
            res.send('Admission number is required');
            return;
        };
        const existingUser = await AppStudent.findOne({adm_no});
        const studentRes = await AdmittedStudent.findOne({'student.adm_no':adm_no});
        if(!studentRes){
            res.send('No students found with this admission number');
            return;
        };


        // Validations
        const {errors, valid} = validateAdmNo(adm_no);
        if(!valid || existingUser || !studentRes){
            if(existingUser) errors.student = 'Student already registered';
            otp = '';
            student = {};
            res.json(errors);
            return;
        };


        // Sending SMS
        const generateOTP = 111111;
        // const generateOTP = Math.random().toString().substr(2, 6);


        // Setting OTP
        otp = generateOTP;
        student = studentRes;


        // OTP timeount
        setTimeout(() => {
            otp = '';
            student = '';
            isOTPVerified = false;
        }, 3600000);


        // Response
        res.status(200).send(studentRes);

    } catch (err) {
        res.status(500).json(err);
    }
});





// Check OTP
router.post('/student/check-otp', async (req, res) => {
    try {

        // Request body
        const {the_otp} = req.body;
        
        
        // Validations
        if(!otp){
            res.send('OTP timeout');
            return;
        };
        const isOtpsEqual = the_otp === otp;
        if(!the_otp){
            res.send('OTP not provided');
            return;
        };
        if(!isOtpsEqual){
            res.send("OTPs don't match");
            return;
        };


        // Setting is otp to be verified
        isOTPVerified = true;


        // Response
        res.status(201).send('Checked successfully');


    } catch (err) {
        res.status(500).json(err.message);
    }
});





// Register student
router.post('/student/register', async (req, res) => {
    try {

        // Checking if OTP has expired
        if(!otp){
            res.send('OTP timeout');
            return;
        };
        if(!isOTPVerified){
            res.send('OTP not verified');
            return;
        };


        // Validations
        const {password, confirm_password} = req.body;
        const {errors, valid} = validateRegisterInputs(password, confirm_password);
        if(!valid){
            res.send(errors);
            return;
        };
        
        
        // Registering the student
        const hashedPassword = bcrypt.hashSync(password);
        const newStudent = await AppStudent.create({
            type:'Student',
            adm_no:student.student.adm_no,
            password:hashedPassword,
            
            student:{
                name:student.student.name,
                class_name:student.student.class,
                image:student.student.image,
                background_image:'',
                doa:student.student.doa,
                dob:student.student.dob,
                email:student.student.email,
                pen_no:student.student.pen_no,
                blood_group:student.student.blood_group,
                house:student.student.house,
                address:student.student.h_no_and_streets,
                contact_person_mobile:student.student.contact_person_mobile,
                roll_no:student.student.roll_no,
                aadhar_card_no:student.student.aadhar_card_no,
                is_new:student.student.is_new,
                is_active:student.student.is_active
            },
            
            parents:{
                father:{
                    father_name:student.parents.father.father_name,
                },
                mother:{
                    mother_name:student.parents.mother.mother_name,
                }
            }
        });
        
        
        // Resetting OTP
        otp = '';
        student = '';
        isOTPVerified = false;
        
        
        // Generating token
        const token = signToken(newStudent);
        res.status(201).json({
            ...newStudent._doc,
            token
        });

    } catch (err) {
        res.status(500).json(err);
    }
});





// Student apply for admission
router.post('/student/apply-for-admission', async (req, res) => {
    try {

        // Request body
        const {
            image,
            dob,
            class_name,
            name,
            middle_name,
            last_name,
            gender,
            father_name,
            father_occupation,
            father_annual_income,
            mother_name,
            mother_occupation,
            mother_annual_income,
            father_mobile,
            mother_mobile,
            email,
            address,
            city,
            state,
            last_school_name,
            last_class,
            amount,
            mobile
        } = req.body;


        // Validations
        const {valid, errors} = validateApplyForAdmission({
            class_name,
            name,
            gender,
            father_name,
            father_occupation,
            father_annual_income,
            mother_name,
            mother_occupation,
            mother_annual_income,
            father_mobile,
            mother_mobile,
            email,
            address,
            city,
            state,
            last_school_name,
            last_class
        });
        if(!valid){
            errors.status = 'failure';
            res.send(errors);
            return;
        };


        // Academic Years
        const activeAcademicYear = await AcademicYear.findOne({is_active:true});


        // Students
        const students = await Student.countDocuments();


        // Generating new registration number
        let substringValue;
        if(students < 9){
            substringValue = 0;
        }else if(students >= 9){
            substringValue = 1;
        }else if(students >= 99){
            substringValue = 2;
        }else if(students >= 999){
            substringValue = 3;
        }else if(students >= 9999){
            substringValue = 4;
        }else if(students >= 99999){
            substringValue = 5;
        }else if(students >= 999999){
            substringValue = 6;
        };
        const admissionNumber = await Admission.findOne({setting_type:'Registration No.'});
        const newAdmissionNo = admissionNumber ? `${admissionNumber?.prefix}${admissionNumber?.lead_zero.substring(substringValue, admissionNumber?.lead_zero?.length - 1)}${students + 1}${admissionNumber?.suffix}` : '';
        if(!newAdmissionNo){
            errors.status = 'failure';
            res.send(errors);
            return;
        };


        // Registering the student
        const newStudent = await Student.create({

            // Session
            session:activeAcademicYear.year_name,


            // Student
            student:{
                // 1
                is_up_for_admission:false,
                is_online:true,
                image,
                enquiry_no:'',
                reg_no:newAdmissionNo,
                pros_no:'',
                amount,
                date:new Date(),
                payment_mode:'',
                admission_account:'',
                post_account:'',
                // 2
                class:class_name,
                board:'',
                stream:'',
                subjects:[],
                optional_subject:'',
                name,
                middle_name,
                last_name,
                dob:dob || new Date(),
                place_of_birth:'',
                gender,
                contact_person_name:'',
                contact_person_mobile:'',
                contact_person_email:'',
                secondary_contact_no:'',
                h_no_and_streets:address,
                email,
                city,
                mobile,
                state,
                pin_code:0,
                aadhar_card_no:0,
                religion:'',
                blood_group:'',
                caste:'',
                category:'',
                is_ews:false,
                sibling:false,
                transport:'',
                nationality:''
            },


            // Parents
            parents:{
                // Father
                father:{
                    father_name,
                    middle_name:'',
                    last_name:'',
                    profession:father_occupation,
                    designation:'',
                    residence_address:'',
                    office_address:'',
                    email:'',
                    alternate_email:'',
                    dob:new Date(),
                    mobile:father_mobile,
                    phone:'',
                    company_name:'',
                    business_details:'',
                    qualification:'',
                    service_in:'',
                    office_phone:0,
                    office_mobile:0,
                    office_extension:'',
                    office_email:'',
                    office_website:'',
                    annual_income:father_annual_income,
                    parent_status:''
                },
                // Mother
                mother:{
                    mother_name,
                    middle_name:'',
                    last_name:'',
                    profession:mother_occupation,
                    designation:'',
                    residence_address:'',
                    office_address:'',
                    email:'',
                    alternate_email:'',
                    dob:new Date(),
                    mobile:mother_mobile,
                    phone:'',
                    company_name:'',
                    business_details:'',
                    qualification:'',
                    service_in:'',
                    office_phone:0,
                    office_mobile:0,
                    office_extension:'',
                    office_email:'',
                    office_website:'',
                    annual_income:mother_annual_income,
                    anniversary_date:new Date()
                }
            },


            // Other details
            others:{
                // 1
                student_other_details:{
                    medical_history:'',
                    descriptions:'',
                    allergies:'',
                    allergies_causes:'',
                    family_doctor_name:'',
                    family_doctor_phone:0,
                    family_doctor_address:'',
                    distance_from_home:'',
                    no_of_living_year:0,
                    only_child:'',
                    general_description:'',
                },
                // 2
                student_staff_relation:{
                    staff_ward:'',
                    staff_name:''
                },
                // 3
                is_alumni:{
                    is_alumni:false,
                    academic_session:'',
                    class_name:'',
                    admission_number:0
                },
                // 4
                previous_school_details:[{
                    class:last_class,
                    school_name:last_school_name,
                    board:'',
                    passing_year:'',
                    total_marks:'',
                    obtain_marks:'',
                    percentage:'',
                    result:''
                }]
            },


            // Guardian details
            guardian_details:{
                // 1
                guardian_name:'',
                profession:'',
                designation:'',
                company_name:'',
                business_details:'',
                qualification:'',
                // 2
                if_single_parent:{
                    student_lives_with:'',
                    legal_custody_of_the_child:'',
                    correspondence_to:'',
                    check_id_applicable:'',
                    separation_reason:''
                }
            }

        });


        // Return
        res.status(201).send({
            status:'success',
            message:'Successfull registration',
            student:newStudent
        });

    } catch (err) {
        console.log(err);
        res.json(err);
    }
});





// Send mobile OTP
router.post('/student/send-mobile-otp', async (req, res) => {
    try {

        // Admission number
        const {mobile} = req.body;


        // Validation
        if(!mobile || Math.abs(mobile).toString().length !== 10){
            res.send({
                status:'failure',
                message:'Please provide a valid mobile number'
            });
            return;
        };


        // Sending SMS
        const generateOTP = 111111;
        // const generateOTP = Math.random().toString().substr(2, 6);


        // Setting OTP
        mobile_otp = generateOTP;


        // OTP timeount
        setTimeout(() => {
            mobile_otp = '';
            isMobileOTPVerified = false;
        }, 3600000);


        // Response
        res.status(200).send({
            status:'success',
            message:'OTP sent successfully'
        });

    } catch (err) {
        res.status(500).json(err);
    }
});





// Check mobile OTP
router.post('/student/check-mobile-otp', async (req, res) => {
    try {

        // Request body
        const {the_otp} = req.body;
        
        
        // Validations
        if(!mobile_otp){
            res.send({
                status:'failure',
                message:'OTP timeout'
            });
            return;
        };
        const isOtpsEqual = the_otp === mobile_otp;
        if(!the_otp){
            res.send({
                status:'failure',
                message:'OTP not provided'
            });
            return;
        };
        if(!isOtpsEqual){
            res.send({
                status:'failure',
                message:"OTPs don't match"
            });
            return;
        };


        // Setting is otp to be verified
        isMobileOTPVerified = true;


        // Response
        res.status(200).send({
            status:'success',
            message:'Checked successfully'
        });


    } catch (err) {
        res.status(500).json(err.message);
    }
});





// Login student
router.post('/student/login', async (req, res) => {
    try {

        // Validations
        const {adm_no, password} = req.body;
        const {errors, valid} = validateLoginInputs(adm_no, password);
        const searchedStudent = await AppStudent.findOne({adm_no});
        if(!valid) {
            res.json(errors);
            return;
        };
        if(!searchedStudent){
            errors.adm_no = 'Wrong credentials.';
            res.json(errors);
            return;
        };
        const match = bcrypt.compareSync(password, searchedStudent.password);
        if(!match){
            errors.adm_no = 'Wrong credentials.';
            res.json(errors);
            return;
        };

;        
        
        // loging the student
        const token = signToken(searchedStudent);
        res.status(200).json({
            ...searchedStudent._doc,
            token
        });


    } catch (err) {
        res.status(500).json(err);
    }
});





// Fetch student fee detalis
router.post('/student/fee', async (req, res) => {
    try {

        // Validations
        const {adm_no} = req.body;


        // Student fee details
        const student = await AdmittedStudent.findOne({'student.adm_no':adm_no});
        const feeDetails = student.affiliated_heads;


        // Response
        res.status(200).json(feeDetails);


    } catch (err) {
        res.status(500).json(err);
    }
});





// Modify student fee heads
router.post('/student/fee/pay', async (req, res) => {
    try {

        // Validations
        const {adm_no, new_heads} = req.body;


        // Student fee details
        await AdmittedStudent.findOneAndUpdate({'student.adm_no':adm_no}, {'affiliated_heads.heads':new_heads});


        // Response
        res.status(200).json('Payment done');

    } catch (err) {
        res.status(500).json(err);
    }
});





// Fetch students admission numbers
router.get('/adm-nos', async (req, res) => {
    try {

        // Student admission numbers
        const studnetsAdmNos = await AppStudent.find({}, {adm_no:1, 'student.name':1, 'student.image':1, 'student.class_name':1});

        // Students array
        const students = studnetsAdmNos.map(s => {
            return {
                _id:s._id,
                adm_no:s.adm_no,
                name:s.student.name,
                image:s.student.image,
                class_name:s.student.class_name,
                role:'Student'
            };
        });


        // Response
        res.status(200).json(students);

    } catch (err) {
        res.status(500).json("Error fetching students admission numbers");
    }
});





// Fetch student by mobile number
router.post('/mobile', async (req, res) => {
    try {

        // Request body
        const {mobile} = req.body;


        // Validation
        if(!mobile){
            res.status(400).send('Please provide a mobile number');
        };


        // Active Academic Year
        const activeAcademicYear = await AcademicYear.findOne({is_active:true});


        // Students
        const students = await Student.find({session:activeAcademicYear.year_name, 'student.contact_person_mobile':mobile});


        // Response
        res.status(200).json(students);

    } catch (err) {
        res.status(500).json(err);
    }
});





// Export
export default router;