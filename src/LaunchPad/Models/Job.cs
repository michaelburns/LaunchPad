using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace LaunchPad.Models
{
    public enum JobType
    {
        Launched,
        Scheduled,
        ScheduledWithRecurring,
        Recurring
    }

    public enum Status
    {
        Started,
        Running,
        Completed,
        Failed,
        Scheduled,
        Recurring,
        Cancelled
    }

    public class Job
    {
        public int Id { get; set; }
        public int JobId { get; set; } //Hangfire Job ID
        public int  ScriptId { get; set; }
        public int RecurringId { get; set; }
        public DateTime Date { get; set; }
        [Display(Name="User")]
        public string UserName { get; set; }
        public string Outcome { get; set; }
        public JobType JobType { get; set; }
       
        public Status Status { get; set; }
    }
}
