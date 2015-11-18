using Hangfire.Common;
using Hangfire.Server;
using Hangfire.States;
using LaunchPad.Models;

namespace LaunchPad.Services
{
    public class UpdateJobStatusFilter : JobFilterAttribute, IServerFilter, IElectStateFilter
    {
        private JobServices _jobService;

        public UpdateJobStatusFilter()
        {
             _jobService = new JobServices();
        }

        public void OnPerformed(PerformedContext filterContext)
        {
            _jobService.UpdateJob(filterContext.BackgroundJob.Id, Status.Completed);
        }

        public void OnPerforming(PerformingContext filterContext)
        {
            var scriptName = filterContext.BackgroundJob.Job.Args[0].ToString();
            _jobService.UpdateJob(filterContext.BackgroundJob.Id, Status.Running, null, scriptName);
        }

        public void OnStateElection(ElectStateContext context)
        {
            var failedState = context.CandidateState as FailedState;
            if (failedState != null)
            {
                _jobService.UpdateJob(context.BackgroundJob.Id, Status.Failed, failedState.Exception.Message);
            }
        }
    }
}
