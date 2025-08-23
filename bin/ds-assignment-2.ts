#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DsAssignment2Stack } from "../lib/ds-assignment-2-stack";
const app = new cdk.App();
new DsAssignment2Stack(app, "DsAssignment2Stack", {});
