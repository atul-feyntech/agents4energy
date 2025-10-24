'use client';
import { Amplify } from 'aws-amplify';
import outputs from '../amplifyOutputs';

if (Object.keys(outputs).length > 0) {
  Amplify.configure(outputs, { ssr: true });
}

const Page = () => null

console.log("Configured AWS Amplify")

export default Page;