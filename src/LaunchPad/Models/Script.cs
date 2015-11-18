using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Threading.Tasks;

namespace LaunchPad.Models
{
    public class Script
    {
        public int Id { get; set; }
        [Required]
        [StringLength(257)]
        public string Name { get; set; }
        public string Author { get; set; }
        public string LastOutput { get; set; }

        public ICollection<Job> Jobs { get; set; }
    }
}
