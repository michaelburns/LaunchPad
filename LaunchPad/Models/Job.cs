using System;
using System.ComponentModel.DataAnnotations;

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
        public int ScriptId { get; set; }
        public int RecurringId { get; set; }
        public DateTime Date { get; set; }

        [Display(Name = "User")]
        public string UserName { get; set; }
        public string Outcome { get; set; }

        // JSON-encoded params used to launch this job (null when no params).
        // Surfaced on the Details page as the "params echoed back" line beneath the running strip.
        public string Args { get; set; }

        public JobType JobType { get; set; }
        public Status Status { get; set; }

        public virtual Script Script { get; set; }
    }
}
